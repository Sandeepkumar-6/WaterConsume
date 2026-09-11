import { userData } from "../services/users.js";
import { User, Area, Consumption, Alert, AuditLog } from "../models/index.js";
import {
  fail,
  id,
  text,
  positive,
  choice,
  date,
  dateRange,
  escapeRegex,
} from "../utils/validation.js";
import { areaScope } from "../middleware/auth.js";
import { serializeMutation, recalculateAlerts } from "../services/limits.js";
const audit = (req, action, entity, entityId) =>
  AuditLog.create({ user: req.user._id, action, entity, entityId });
const found = (doc) => {
  if (!doc) fail("Resource not found.", 404);
  return doc;
};
const statuses = ["ACTIVE", "INACTIVE"];
export async function listAreas(req, res) {
  const filter =
    req.user.role === "STAFF" ? { _id: req.user.assignedArea || null } : {};
  if (req.query.status)
    filter.status = choice(req.query.status, statuses, "status");
  if (req.query.search)
    filter.$or = ["name", "code", "location"].map((k) => ({
      [k]: { $regex: escapeRegex(req.query.search), $options: "i" },
    }));
  res.json(
    await Area.find(filter)
      .populate("responsibleStaff", "name email")
      .sort({ name: 1 }),
  );
}
export async function getArea(req, res) {
  const area = id(req.params.id);
  areaScope(req.user, area);
  res.json(
    found(await Area.findById(area).populate("responsibleStaff", "name email")),
  );
}
async function areaData(body) {
  const data = {
    name: text(body.name, "Area name"),
    code: text(body.code, "Building code", 30),
    location: text(body.location, "Location", 200),
    dailyLimit: positive(body.dailyLimit, "Daily limit"),
    monthlyLimit: positive(body.monthlyLimit, "Monthly limit"),
    status: choice(body.status || "ACTIVE", statuses, "status"),
    responsibleStaff: body.responsibleStaff || null,
  };
  if (data.responsibleStaff) {
    const staff = found(await User.findById(id(data.responsibleStaff)));
    if (staff.role !== "STAFF" || staff.status !== "ACTIVE")
      fail("Responsible staff must be an active staff account.");
  }
  return data;
}
async function syncResponsible(area, previousResponsible) {
  if (
    previousResponsible &&
    String(previousResponsible) !== String(area.responsibleStaff || "")
  ) {
    await User.updateOne(
      { _id: previousResponsible, assignedArea: area._id },
      { assignedArea: null },
    );
  }
  if (!area.responsibleStaff) {
    await User.updateMany(
      { assignedArea: area._id },
      { $set: { assignedArea: null } },
    );
    return;
  }
  await User.updateMany(
    { assignedArea: area._id, _id: { $ne: area.responsibleStaff } },
    { $set: { assignedArea: null } },
  );
  await Area.updateMany(
    { _id: { $ne: area._id }, responsibleStaff: area.responsibleStaff },
    { responsibleStaff: null },
  );
  await User.findByIdAndUpdate(area.responsibleStaff, {
    assignedArea: area._id,
  });
}
async function syncUserAssignment(user) {
  const assigned =
    user.role === "STAFF" && user.status === "ACTIVE"
      ? user.assignedArea
      : null;
  await Area.updateMany(
    {
      responsibleStaff: user._id,
      ...(assigned ? { _id: { $ne: assigned } } : {}),
    },
    { $set: { responsibleStaff: null } },
  );
  if (!assigned) return;
  const area = found(await Area.findById(assigned));
  const previousResponsible = area.responsibleStaff;
  if (previousResponsible && String(previousResponsible) !== String(user._id))
    await User.updateOne(
      { _id: previousResponsible, assignedArea: area._id },
      { $set: { assignedArea: null } },
    );
  await User.updateMany(
    { assignedArea: area._id, _id: { $ne: user._id } },
    { $set: { assignedArea: null } },
  );
  area.responsibleStaff = user._id;
  await area.save();
}
export async function saveArea(req, res) {
  await serializeMutation(async () => {
    const data = await areaData(req.body || {});
    const previous = req.params.id
      ? found(await Area.findById(id(req.params.id)))
      : null;
    const area = req.params.id
      ? found(
          await Area.findByIdAndUpdate(id(req.params.id), data, {
            new: true,
            runValidators: true,
          }),
        )
      : await Area.create(data);
    await syncResponsible(area, previous?.responsibleStaff);
    await recalculateAlerts(area._id);
    await audit(
      req,
      req.params.id ? "AREA_UPDATED" : "AREA_CREATED",
      "Area",
      area._id,
    );
    res.status(req.params.id ? 200 : 201).json(area);
  });
}
export async function deleteArea(req, res) {
  await serializeMutation(async () => {
    const area = found(await Area.findById(id(req.params.id)));
    area.status = "INACTIVE";
    await area.save();
    await audit(req, "AREA_DEACTIVATED", "Area", area._id);
    res.json(area);
  });
}
export async function updateAreaStatus(req, res) {
  await serializeMutation(async () => {
    const status = choice(req.body?.status, statuses, "status");
    const area = found(await Area.findById(id(req.params.id)));
    area.status = status;
    await area.save();
    await recalculateAlerts(area._id);
    await audit(
      req,
      status === "ACTIVE" ? "AREA_REACTIVATED" : "AREA_DEACTIVATED",
      "Area",
      area._id,
    );
    res.json(area);
  });
}
export async function hardDeleteArea(req, res) {
  await serializeMutation(async () => {
    const areaId = id(req.params.id);
    const area = found(await Area.findById(areaId));
    if (await Consumption.exists({ area: areaId }))
      fail(
        "Cannot delete this area because consumption history exists. Set the area to inactive instead.",
        409,
      );
    await User.updateMany(
      { assignedArea: areaId },
      { $set: { assignedArea: null } },
    );
    await Alert.deleteMany({ area: areaId });
    await area.deleteOne();
    await audit(req, "AREA_DELETED", "Area", areaId);
    res.json({ success: true });
  });
}
export async function listUsers(req, res) {
  const filter = {};
  if (req.query.search)
    filter.$or = ["name", "email"].map((k) => ({
      [k]: { $regex: escapeRegex(req.query.search), $options: "i" },
    }));
  if (req.query.status)
    filter.status = choice(req.query.status, statuses, "status");
  res.json(
    await User.find(filter)
      .populate("assignedArea", "name")
      .sort({ createdAt: -1 }),
  );
}
export async function getUser(req, res) {
  res.json(
    found(
      await User.findById(id(req.params.id)).populate("assignedArea", "name"),
    ),
  );
}
export async function saveUser(req, res) {
  await serializeMutation(async () => {
    const b = req.body || {};
    const data = await userData(b, { creating: !req.params.id });
    const previous = req.params.id
      ? found(await User.findById(id(req.params.id)))
      : null;
    if (
      req.params.id === String(req.user._id) &&
      (data.role !== "ADMIN" || data.status !== "ACTIVE")
    )
      fail("You cannot deactivate or demote your own account.");
    const user = req.params.id
      ? found(
          await User.findByIdAndUpdate(id(req.params.id), data, {
            new: true,
            runValidators: true,
          }),
        )
      : await User.create(data);
    await syncUserAssignment(user);
    await audit(
      req,
      req.params.id ? "USER_UPDATED" : "USER_CREATED",
      "User",
      user._id,
    );
    res.status(req.params.id ? 200 : 201).json(user);
  });
}
export async function deleteUser(req, res) {
  await serializeMutation(async () => {
    const userId = id(req.params.id);
    if (userId === String(req.user._id))
      fail("You cannot deactivate your own account.");
    const user = found(
      await User.findByIdAndUpdate(
        userId,
        { status: "INACTIVE", assignedArea: null },
        { new: true, runValidators: true },
      ),
    );
    await Area.updateMany(
      { responsibleStaff: userId },
      { responsibleStaff: null },
    );
    await audit(req, "USER_DEACTIVATED", "User", userId);
    res.json(user);
  });
}
export async function updateUserStatus(req, res) {
  await serializeMutation(async () => {
    const userId = id(req.params.id);
    const status = choice(req.body?.status, statuses, "status");
    if (userId === String(req.user._id) && status === "INACTIVE")
      fail("You cannot deactivate your own account.");
    const user = found(await User.findById(userId));
    user.status = status;
    if (status === "INACTIVE") user.assignedArea = null;
    await user.save();
    await syncUserAssignment(user);
    await audit(
      req,
      status === "ACTIVE" ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      "User",
      user._id,
    );
    res.json(user);
  });
}
export async function hardDeleteUser(req, res) {
  await serializeMutation(async () => {
    const userId = id(req.params.id);
    if (userId === String(req.user._id))
      fail("You cannot delete your own account.");
    const user = found(await User.findById(userId));
    const [consumption, resolvedAlerts, auditHistory] = await Promise.all([
      Consumption.exists({ recordedBy: userId }),
      Alert.exists({ resolvedBy: userId }),
      AuditLog.exists({ user: userId }),
    ]);
    if (consumption || resolvedAlerts || auditHistory)
      fail(
        "Cannot delete this user because historical records reference this account. Deactivate the user instead.",
        409,
      );
    await Area.updateMany(
      { responsibleStaff: userId },
      { $set: { responsibleStaff: null } },
    );
    await user.deleteOne();
    await audit(req, "USER_DELETED", "User", userId);
    res.json({ success: true });
  });
}
export function consumptionFilter(req) {
  if (req.query.area) id(req.query.area);
  const filter = areaScope(req.user, req.query.area);
  const range = dateRange(req.query);
  if (Object.keys(range).length) filter.date = range;
  if (req.query.date) filter.date = date(req.query.date);
  return filter;
}
export async function listConsumption(req, res) {
  const filter = consumptionFilter(req);
  let records = await Consumption.find(filter)
    .populate("area", "name code")
    .populate("recordedBy", "name")
    .sort({ date: -1, createdAt: -1 })
    .lean();
  if (req.query.search) {
    const q = String(req.query.search).toLowerCase();
    records = records.filter((r) =>
      `${r.area?.name} ${r.notes} ${r.recordedBy?.name}`
        .toLowerCase()
        .includes(q),
    );
  }
  res.json(records);
}
export async function getConsumption(req, res) {
  const recordId = id(req.params.id);
  const raw = found(await Consumption.findById(recordId));
  areaScope(req.user, String(raw.area));
  const record = await Consumption.findById(recordId)
    .populate("area", "name code")
    .populate("recordedBy", "name");
  res.json(record);
}
export async function saveConsumption(req, res) {
  await serializeMutation(async () => {
    const b = req.body || {};
    id(b.area);
    areaScope(req.user, b.area);
    const area = found(await Area.findById(b.area));
    if (area.status !== "ACTIVE")
      fail("Consumption can only be recorded for an active area.");
    const data = {
      area: b.area,
      date: date(b.date),
      amount: positive(b.amount, "Consumption amount"),
      unit: choice(b.unit || "Litres", ["Litres"], "unit"),
      notes:
        b.notes == null || b.notes === "" ? "" : text(b.notes, "Notes", 1000),
    };
    let oldArea;
    let record;
    if (req.params.id) {
      record = found(await Consumption.findById(id(req.params.id)));
      if (!(await User.exists({ _id: record.recordedBy })))
        fail("The user associated with this record no longer exists.");
      oldArea = String(record.area);
      Object.assign(record, data);
      await record.save();
    } else
      record = await Consumption.create({ ...data, recordedBy: req.user._id });
    await recalculateAlerts(area._id);
    if (oldArea && oldArea !== b.area) await recalculateAlerts(oldArea);
    await audit(
      req,
      req.params.id ? "CONSUMPTION_UPDATED" : "CONSUMPTION_CREATED",
      "Consumption",
      record._id,
    );
    res.status(req.params.id ? 200 : 201).json(record);
  });
}
export async function deleteConsumption(req, res) {
  await serializeMutation(async () => {
    const record = found(
      await Consumption.findByIdAndDelete(id(req.params.id)),
    );
    await recalculateAlerts(record.area);
    await audit(req, "CONSUMPTION_DELETED", "Consumption", record._id);
    res.json({ success: true });
  });
}
export async function listAlerts(req, res) {
  if (req.query.area) id(req.query.area);
  const filter = areaScope(req.user, req.query.area);
  if (req.query.status)
    filter.status = choice(
      req.query.status,
      ["UNREAD", "READ", "RESOLVED"],
      "alert status",
    );
  res.json(
    await Alert.find(filter)
      .populate("area", "name")
      .populate("resolvedBy", "name")
      .sort({ createdAt: -1 }),
  );
}
export async function updateAlert(req, res) {
  await serializeMutation(async () => {
    const status = choice(
      req.body?.status,
      ["UNREAD", "READ", "RESOLVED"],
      "alert status",
    );
    const alert = found(
      await Alert.findByIdAndUpdate(
        id(req.params.id),
        {
          status,
          resolvedAt: status === "RESOLVED" ? new Date() : null,
          resolvedBy: status === "RESOLVED" ? req.user._id : null,
          autoResolved: false,
        },
        { new: true },
      ),
    );
    await audit(req, `ALERT_${status}`, "Alert", alert._id);
    res.json(alert);
  });
}
