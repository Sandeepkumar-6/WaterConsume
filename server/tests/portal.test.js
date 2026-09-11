import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import app from "../app.js";
import { User, Area, Consumption, Alert, AuditLog } from "../models/index.js";
import { limitStatus } from "../services/limits.js";
import { today } from "../utils/validation.js";
let adminToken, staffToken, areaId, staffId;
const testDb = `smart_water_portal_test_${Date.now()}`;
const api = (method, path, token = adminToken) =>
  request(app)[method](`/api${path}`).set("Authorization", `Bearer ${token}`);
before(async () => {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: testDb,
    serverSelectionTimeoutMS: 5000,
  });
  await Promise.all([
    User.init(),
    Area.init(),
    Consumption.init(),
    Alert.init(),
  ]);
  await User.create({
    name: "Test Admin",
    email: "testadmin@example.com",
    password: await bcrypt.hash("Admin@123", 12),
    role: "ADMIN",
  });
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "testadmin@example.com", password: "Admin@123" })
    .expect(200);
  adminToken = login.body.token;
  assert.equal(login.body.user.password, undefined);
});
after(async () => {
  // Only remove the isolated database created by this test run.
  if (
    mongoose.connection.name === testDb &&
    testDb.startsWith("smart_water_portal_test_")
  )
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
test("registration stores both roles, hashes passwords and validates inputs", async () => {
  const body = {
    name: "Registered Staff",
    email: "registered@example.com",
    password: "Register@123",
    confirmPassword: "Register@123",
    role: "STAFF",
  };
  for (const override of [
    { name: " " },
    { email: "bad" },
    { password: "short" },
    { confirmPassword: "different" },
    { role: "OWNER" },
    { role: undefined },
    { password: "a".repeat(73) },
  ])
    await request(app)
      .post("/api/auth/register")
      .send({ ...body, ...override })
      .expect(400);
  for (const role of ["STAFF", "ADMIN"]) {
    const email = `${role.toLowerCase()}-registered@example.com`;
    const result = await request(app)
      .post("/api/auth/register")
      .send({
        ...body,
        email,
        role,
        assignedArea: new mongoose.Types.ObjectId().toString(),
        status: "INACTIVE",
      })
      .expect(201);
    assert.equal(result.body.role, role);
    assert.equal(result.body.assignedArea, null);
    assert.equal(result.body.status, "ACTIVE");
    assert.equal(result.body.password, undefined);
    const saved = await User.findById(result.body._id).select("+password");
    assert.ok(await bcrypt.compare(body.password, saved.password));
    await request(app)
      .post("/api/auth/register")
      .send({ ...body, role, email: email.toUpperCase() })
      .expect(409);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: body.password })
      .expect(200);
    if (role === "STAFF")
      await api("get", "/users", login.body.token).expect(403);
  }
});

test("Indian calendar dates stay consistent at UTC day boundaries", () => {
  assert.equal(today(new Date("2026-09-09T18:29:59Z")), "2026-09-09");
  assert.equal(today(new Date("2026-09-09T18:30:00Z")), "2026-09-10");
});

test("production registration blocks admin escalation but preserves staff login and admin provisioning", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const body = {
    name: "Production staff",
    email: "production-staff@example.com",
    password: "Production-test-123!",
    confirmPassword: "Production-test-123!",
    role: "STAFF",
  };
  try {
    await request(app)
      .post("/api/auth/register")
      .send({ ...body, role: "ADMIN" })
      .expect(403);
    assert.equal(await User.countDocuments({ email: body.email }), 0);
    await request(app).post("/api/auth/register").send(body).expect(201);
    const login = await request(app)
      .post("/api/auth/login")
      .send(body)
      .expect(200);
    await api("get", "/auth/me", login.body.token).expect(200);
    await api("get", "/dashboard", login.body.token).expect(200);
    await api("post", "/users", login.body.token)
      .send({ ...body, role: "ADMIN" })
      .expect(403);
    await api("post", "/users")
      .send({ ...body, email: "provisioned-admin@example.com", role: "ADMIN" })
      .expect(201);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("CORS allows both local frontend addresses and excludes unrelated origins", async () => {
  for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173"]) {
    const response = await request(app)
      .options("/api/auth/login")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
    assert.equal(response.headers["access-control-allow-origin"], origin);
  }
  const response = await request(app)
    .get("/api/health")
    .set("Origin", "http://unrelated.example")
    .expect(200);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
});
test("limit boundaries: below 90%, 90%, 100%, and above 100%", () => {
  assert.equal(limitStatus(4499, 5000), "NORMAL");
  assert.equal(limitStatus(4500, 5000), "WARNING");
  assert.equal(limitStatus(5000, 5000), "WARNING");
  assert.equal(limitStatus(5001, 5000), "EXCEEDED");
});
test("authentication rejects missing JWT, wrong password and malformed inputs", async () => {
  await request(app).post("/api/auth/login").expect(400);
  await request(app).post("/api/auth/register").expect(400);
  await api("post", "/areas").expect(400);
  await api("post", "/users").expect(400);
  await api("post", "/consumption").expect(400);
  await request(app).get("/api/dashboard").expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "testadmin@example.com", password: "wrong" })
    .expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: { $ne: "" }, password: "wrong" })
    .expect(400);
  await api("get", "/auth/me", "invalid").expect(401);
});
test("admin creates area and assigned staff; duplicate codes and emails rejected", async () => {
  const body = {
    name: "Test Building",
    code: "TEST",
    location: "Test campus",
    dailyLimit: 5000,
    monthlyLimit: 100000,
  };
  const area = await api("post", "/areas").send(body).expect(201);
  areaId = area.body._id;
  const duplicateArea = await api("post", "/areas").send(body).expect(409);
  assert.equal(duplicateArea.body.message, "Area code already exists.");
  await api("get", `/areas/${areaId}`).expect(200);
  const staff = {
    name: "Test Staff",
    email: "teststaff@example.com",
    password: "Staff@123",
    role: "STAFF",
    assignedArea: areaId,
  };
  const result = await api("post", "/users").send(staff).expect(201);
  staffId = result.body._id;
  assert.equal(result.body.password, undefined);
  const saved = await User.findById(staffId).select("+password");
  assert.notEqual(saved.password, "Staff@123");
  assert.ok(await bcrypt.compare("Staff@123", saved.password));
  assert.equal(String((await Area.findById(areaId)).responsibleStaff), staffId);
  const duplicateUser = await api("post", "/users").send(staff).expect(409);
  assert.equal(duplicateUser.body.message, "Email already exists.");
  staffToken = (
    await request(app)
      .post("/api/auth/login")
      .send({ email: staff.email, password: staff.password })
      .expect(200)
  ).body.token;
});
test("exact scenario: 3000 normal, 5500 exceeded, stored alert, updated charts and reports", async () => {
  const first = await api("post", "/consumption")
    .send({ area: areaId, date: today(), amount: 3000, recordedBy: staffId })
    .expect(201);
  assert.notEqual(first.body.recordedBy, staffId);
  let dash = (await api("get", "/dashboard").expect(200)).body;
  assert.equal(dash.summary.total, 3000);
  assert.equal(dash.limits[0].status, "NORMAL");
  await api("post", "/consumption")
    .send({ area: areaId, date: today(), amount: 2500 })
    .expect(201);
  dash = (await api("get", "/dashboard").expect(200)).body;
  assert.equal(dash.summary.total, 5500);
  assert.equal(dash.summary.exceeded, 1);
  assert.equal(dash.limits[0].dailyStatus, "EXCEEDED");
  assert.equal(dash.dailyConsumption[0].amount, 5500);
  assert.equal(await Consumption.countDocuments({ area: areaId }), 2);
  const alert = await Alert.findOne({
    area: areaId,
    type: "DAILY",
    period: today(),
  });
  assert.equal(alert.consumption, 5500);
  await api("patch", `/alerts/${alert._id}/status`)
    .send({ status: "READ" })
    .expect(200);
  await api("patch", `/alerts/${alert._id}/status`)
    .send({ status: "UNREAD" })
    .expect(200);
  assert.equal((await Alert.findById(alert._id)).status, "UNREAD");
  await api("patch", `/alerts/${alert._id}/status`)
    .send({ status: "RESOLVED" })
    .expect(200);
  assert.equal((await Alert.findById(alert._id)).status, "RESOLVED");
  const report = (
    await api(
      "get",
      `/reports?area=${areaId}&startDate=${today()}&endDate=${today()}&status=EXCEEDED`,
    ).expect(200)
  ).body;
  assert.equal(report.summary.total, 5500);
  assert.equal(report.summary.violations, 1);
  assert.equal(report.rows.length, 1);
});
test("staff can only read and add to their assigned area; admin operations forbidden", async () => {
  const other = await api("post", "/areas")
    .send({
      name: "Other",
      code: "OTHER",
      location: "West",
      dailyLimit: 1000,
      monthlyLimit: 20000,
    })
    .expect(201);
  const list = await api("get", "/areas", staffToken).expect(200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0]._id, areaId);
  await api("get", `/areas/${other.body._id}`, staffToken).expect(403);
  await api("get", `/consumption?area=${other.body._id}`, staffToken).expect(
    403,
  );
  await api("get", `/alerts?area=${other.body._id}`, staffToken).expect(403);
  await api("post", "/consumption", staffToken)
    .send({ area: other.body._id, date: today(), amount: 100 })
    .expect(403);
  await api("post", "/consumption", staffToken)
    .send({ area: areaId, date: today(), amount: 100 })
    .expect(201);
  for (const path of ["/users", "/reports", "/monitoring"])
    await api("get", path, staffToken).expect(403);
  await api("post", "/areas", staffToken).send({}).expect(403);
  await api("put", `/areas/${areaId}`, staffToken).send({}).expect(403);
  const record = await Consumption.findOne({ area: areaId });
  await api("put", `/consumption/${record._id}`, staffToken)
    .send({})
    .expect(403);
  await api("delete", `/consumption/${record._id}`, staffToken).expect(403);
  const alerts = await api("get", "/alerts", staffToken).expect(200);
  assert.ok(alerts.body.every((a) => a.area._id === areaId));
  assert.equal(
    (await api("get", "/dashboard", staffToken)).body.summary.areas,
    1,
  );
});
test("assignments stay synchronized; status changes and permanent deletes are safe", async () => {
  const reassignmentArea = (
    await api("post", "/areas")
      .send({
        name: "Reassignment Area",
        code: "REASSIGN",
        location: "East",
        dailyLimit: 6000,
        monthlyLimit: 180000,
      })
      .expect(201)
  ).body;
  await api("put", `/users/${staffId}`)
    .send({
      name: "Test Staff",
      email: "teststaff@example.com",
      role: "STAFF",
      status: "ACTIVE",
      assignedArea: reassignmentArea._id,
    })
    .expect(200);
  assert.equal((await Area.findById(areaId)).responsibleStaff, null);
  assert.equal(
    String((await Area.findById(reassignmentArea._id)).responsibleStaff),
    staffId,
  );
  await request(app)
    .post("/api/auth/login")
    .send({ email: "teststaff@example.com", password: "Staff@123" })
    .expect(200);

  await api("patch", `/users/${staffId}/status`)
    .send({ status: "INACTIVE" })
    .expect(200);
  assert.equal((await User.findById(staffId)).assignedArea, null);
  assert.equal(
    (await Area.findById(reassignmentArea._id)).responsibleStaff,
    null,
  );
  await request(app)
    .post("/api/auth/login")
    .send({ email: "teststaff@example.com", password: "Staff@123" })
    .expect(403);
  await api("patch", `/users/${staffId}/status`)
    .send({ status: "ACTIVE" })
    .expect(200);

  const disposableUser = (
    await api("post", "/users")
      .send({
        name: "Disposable User",
        email: "disposable@example.com",
        password: "Staff@123",
        role: "STAFF",
      })
      .expect(201)
  ).body;
  await api("put", `/users/${disposableUser._id}`)
    .send({
      name: disposableUser.name,
      email: disposableUser.email,
      role: "STAFF",
      status: "ACTIVE",
      password: "Changed@123",
    })
    .expect(200);
  await request(app)
    .post("/api/auth/login")
    .send({ email: disposableUser.email, password: "Staff@123" })
    .expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: disposableUser.email, password: "Changed@123" })
    .expect(200);
  await api("delete", `/users/${disposableUser._id}/permanent`).expect(200);
  await api("get", `/users/${disposableUser._id}`).expect(404);

  const disposableArea = (
    await api("post", "/areas")
      .send({
        name: "Disposable Area",
        code: "DISPOSABLE",
        location: "Temporary",
        dailyLimit: 100,
        monthlyLimit: 1000,
      })
      .expect(201)
  ).body;
  await api("patch", `/areas/${disposableArea._id}/status`)
    .send({ status: "INACTIVE" })
    .expect(200);
  assert.equal((await Area.findById(disposableArea._id)).status, "INACTIVE");
  await api("patch", `/areas/${disposableArea._id}/status`)
    .send({ status: "ACTIVE" })
    .expect(200);
  await api("delete", `/areas/${disposableArea._id}/permanent`).expect(200);
  await api("get", `/areas/${disposableArea._id}`).expect(404);

  const userConflict = await api(
    "delete",
    `/users/${staffId}/permanent`,
  ).expect(409);
  assert.match(userConflict.body.message, /historical records/);
  const areaConflict = await api("delete", `/areas/${areaId}/permanent`).expect(
    409,
  );
  assert.match(areaConflict.body.message, /consumption history/);
  await api("put", `/users/${staffId}`)
    .send({
      name: "Test Staff",
      email: "teststaff@example.com",
      role: "STAFF",
      status: "ACTIVE",
      assignedArea: areaId,
    })
    .expect(200);
});
test("record validation rejects invalid dates, nonpositive values and invalid areas", async () => {
  for (const override of [
    { amount: 0 },
    { amount: -1 },
    { amount: "abc" },
    { date: "2026-02-30" },
    { area: "bad" },
    { unit: "Gallons" },
  ])
    await api("post", "/consumption")
      .send({ area: areaId, date: today(), amount: 50, ...override })
      .expect(400);
  await api(
    "get",
    "/monitoring?startDate=2026-09-09&endDate=2026-01-01",
  ).expect(400);
  await api("get", "/monitoring?view=Yearly").expect(400);
  await api("get", "/areas/000000000000000000000000").expect(404);
});
test("monthly alerts, deduplication, edits, deletion and automatic resolution", async () => {
  const big = await api("post", "/consumption")
    .send({ area: areaId, date: today(), amount: 100001 })
    .expect(201);
  assert.equal(
    await Alert.countDocuments({ area: areaId, type: "MONTHLY" }),
    1,
  );
  await api("put", `/consumption/${big.body._id}`)
    .send({ area: areaId, date: today(), amount: 100002 })
    .expect(200);
  assert.equal(await Alert.countDocuments({ area: areaId, type: "DAILY" }), 1);
  assert.equal(
    await Alert.countDocuments({ area: areaId, type: "MONTHLY" }),
    1,
  );
  await api("delete", `/consumption/${big.body._id}`).expect(200);
  const alert = await Alert.findOne({ area: areaId, type: "MONTHLY" });
  assert.equal(alert.status, "RESOLVED");
  assert.equal(alert.autoResolved, true);
  const newBig = await api("post", "/consumption")
    .send({ area: areaId, date: today(), amount: 100001 })
    .expect(201);
  assert.equal((await Alert.findById(alert._id)).status, "UNREAD");
  await api("delete", `/consumption/${newBig.body._id}`).expect(200);
});
test("monitoring groups records; filters and reports handle empty results", async () => {
  for (const view of ["Daily", "Weekly", "Monthly"]) {
    const { body } = await api("get", `/monitoring?view=${view}`).expect(200);
    assert.equal(body.summary.total, 5600);
    assert.equal(body.trend.length, 1);
  }
  assert.equal(
    (await api("get", "/consumption?search=Test%20Building")).body.length,
    3,
  );
  const { body } = await api(
    "get",
    "/reports?startDate=2000-01-01&endDate=2000-01-02",
  ).expect(200);
  assert.equal(body.summary.total, 0);
  assert.equal(body.summary.average, 0);
  assert.deepEqual(body.rows, []);
});
test("area edits recalculate limits; deactivation preserves history and blocks entries", async () => {
  await api("put", `/areas/${areaId}`)
    .send({
      name: "Test Building updated",
      code: "TEST",
      location: "North",
      dailyLimit: 50000,
      monthlyLimit: 100000,
      responsibleStaff: staffId,
    })
    .expect(200);
  assert.equal((await api("get", "/dashboard")).body.summary.exceeded, 0);
  await api("delete", `/areas/${areaId}`).expect(200);
  await api("post", "/consumption", staffToken)
    .send({ area: areaId, date: today(), amount: 50 })
    .expect(400);
  assert.equal(await Consumption.countDocuments({ area: areaId }), 3);
});
test("moving a record clears its old periods and checks the new area; monthly warning is inclusive", async () => {
  const create = async (code) =>
    (
      await api("post", "/areas")
        .send({
          name: code,
          code,
          location: "Test wing",
          dailyLimit: 1000,
          monthlyLimit: 2000,
        })
        .expect(201)
    ).body;
  const a = await create("MOVE-A"),
    b = await create("MOVE-B");
  const row = (
    await api("post", "/consumption")
      .send({ area: a._id, date: today(), amount: 1800 })
      .expect(201)
  ).body;
  const own = (await api("get", "/dashboard")).body.limits.find(
    (x) => x.area === a._id,
  );
  assert.equal(own.monthlyStatus, "WARNING");
  await api("put", `/consumption/${row._id}`)
    .send({ area: b._id, date: "2020-01-01", amount: 2200 })
    .expect(200);
  assert.equal(
    (await Alert.findOne({ area: a._id, type: "DAILY" })).status,
    "RESOLVED",
  );
  assert.equal(
    (await Alert.findOne({ area: b._id, type: "MONTHLY", period: "2020-01" }))
      .consumption,
    2200,
  );
  await api("delete", `/consumption/${row._id}`).expect(200);
  assert.equal(
    (await Alert.findOne({ area: b._id, type: "MONTHLY" })).status,
    "RESOLVED",
  );
});

test("Engineering Block and its consumption persist and feed every database-backed view", async () => {
  const engineering = (
    await api("post", "/areas")
      .send({
        name: "Engineering Block",
        code: "ENG",
        location: "South campus",
        dailyLimit: 9000,
        monthlyLimit: 216000,
      })
      .expect(201)
  ).body;
  const record = (
    await api("post", "/consumption")
      .send({
        area: engineering._id,
        date: today(),
        amount: 4321,
        unit: "Litres",
        notes: "Persistence verification",
      })
      .expect(201)
  ).body;
  assert.equal(record.area, engineering._id);
  assert.equal(record.recordedBy, (await api("get", "/auth/me")).body._id);
  assert.equal(record.date, today());
  assert.equal(record.amount, 4321);
  assert.equal(record.unit, "Litres");
  assert.ok(record.createdAt && record.updatedAt);

  const areaList = (await api("get", "/areas")).body;
  assert.ok(areaList.some((area) => area._id === engineering._id));
  assert.ok(
    (await api("get", "/monitoring")).body.limitRows.some(
      (row) => row.area === engineering._id,
    ),
  );
  assert.ok(
    (await api("get", "/reports")).body.rows.some(
      (row) => row.area === engineering._id,
    ),
  );
  assert.ok(
    (await api("get", "/dashboard")).body.limits.some(
      (row) => row.area === engineering._id && row.daily === 4321,
    ),
  );

  await mongoose.disconnect();
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: testDb,
    serverSelectionTimeoutMS: 5000,
  });
  assert.ok(await Area.exists({ _id: engineering._id }));
  assert.ok(await Consumption.exists({ _id: record._id }));
  await api("get", `/areas/${engineering._id}`).expect(200);
  await api("get", `/consumption/${record._id}`).expect(200);
});

test("user edits revoke access, protect own admin, and deactivate without breaking history", async () => {
  await api("put", `/users/${staffId}`)
    .send({
      name: "Staff updated",
      email: "teststaff@example.com",
      role: "STAFF",
      status: "INACTIVE",
    })
    .expect(200);
  await api("get", "/dashboard", staffToken).expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "teststaff@example.com", password: "Staff@123" })
    .expect(403);
  const me = (await api("get", "/auth/me")).body;
  await api("delete", `/users/${me._id}`).expect(400);
  await api("put", `/users/${me._id}`)
    .send({ name: me.name, email: me.email, role: "STAFF" })
    .expect(400);
  const historicalRecords = await Consumption.countDocuments({
    recordedBy: staffId,
  });
  await api("delete", `/users/${staffId}`).expect(200);
  const deactivated = (await api("get", `/users/${staffId}`).expect(200)).body;
  assert.equal(deactivated.status, "INACTIVE");
  assert.equal(deactivated.assignedArea, null);
  assert.equal(
    await Consumption.countDocuments({ recordedBy: staffId }),
    historicalRecords,
  );
  assert.ok((await AuditLog.countDocuments()) > 0);
});

test("complete Engineering Block workflow recalculates warnings, alerts and access", async () => {
  const engineering = (
    await api("post", "/areas")
      .send({
        name: "Engineering Workflow Block",
        code: "ENG-WORKFLOW",
        location: "South campus",
        dailyLimit: 6000,
        monthlyLimit: 180000,
      })
      .expect(201)
  ).body;
  const rohan = (
    await api("post", "/users")
      .send({
        name: "Rohan Mehta",
        email: "rohan@smartwater.demo",
        password: "Staff@123",
        role: "STAFF",
        assignedArea: engineering._id,
      })
      .expect(201)
  ).body;
  const rohanToken = (
    await request(app)
      .post("/api/auth/login")
      .send({ email: rohan.email, password: "Staff@123" })
      .expect(200)
  ).body.token;
  const visibleAreas = await api("get", "/areas", rohanToken).expect(200);
  assert.deepEqual(
    visibleAreas.body.map((area) => area._id),
    [engineering._id],
  );
  const reading = (
    await api("post", "/consumption", rohanToken)
      .send({ area: engineering._id, date: today(), amount: 4000 })
      .expect(201)
  ).body;
  let limit = (await api("get", "/dashboard")).body.limits.find(
    (row) => row.area === engineering._id,
  );
  assert.equal(limit.status, "NORMAL");
  await api("put", `/consumption/${reading._id}`)
    .send({ area: engineering._id, date: today(), amount: 5600 })
    .expect(200);
  limit = (await api("get", "/dashboard")).body.limits.find(
    (row) => row.area === engineering._id,
  );
  assert.equal(limit.status, "WARNING");
  assert.equal(await Alert.countDocuments({ area: engineering._id }), 0);
  await api("put", `/consumption/${reading._id}`)
    .send({ area: engineering._id, date: today(), amount: 6001 })
    .expect(200);
  const alert = await Alert.findOne({
    area: engineering._id,
    type: "DAILY",
    period: today(),
  });
  assert.equal(alert.status, "UNREAD");
  assert.equal(
    (await api("get", `/alerts?area=${engineering._id}`)).body.length,
    1,
  );
  await api("put", `/consumption/${reading._id}`)
    .send({ area: engineering._id, date: today(), amount: 4000 })
    .expect(200);
  assert.equal((await Alert.findById(alert._id)).status, "RESOLVED");
  await api("put", `/consumption/${reading._id}`)
    .send({ area: engineering._id, date: today(), amount: 6001 })
    .expect(200);
  assert.equal((await Alert.findById(alert._id)).status, "UNREAD");
  await api("delete", `/areas/${engineering._id}/permanent`).expect(409);
  await api("patch", `/areas/${engineering._id}/status`)
    .send({ status: "INACTIVE" })
    .expect(200);
  await api("post", "/consumption", rohanToken)
    .send({ area: engineering._id, date: today(), amount: 1 })
    .expect(400);
  await api("delete", `/consumption/${reading._id}`).expect(200);
  assert.equal((await Alert.findById(alert._id)).status, "RESOLVED");
  await api("patch", `/users/${rohan._id}/status`)
    .send({ status: "INACTIVE" })
    .expect(200);
  await api("get", "/dashboard", rohanToken).expect(401);
});

test("database outage gives a clear error and saved data persists after reconnect", async () => {
  const count = await Consumption.countDocuments();
  await mongoose.disconnect();
  await request(app).get("/api/health").expect(503);
  const result = await api("get", "/dashboard").expect(503);
  assert.match(result.body.message, /MongoDB is unavailable/);
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: testDb,
    serverSelectionTimeoutMS: 5000,
  });
  assert.equal(await Consumption.countDocuments(), count);
  await api("get", "/dashboard").expect(200);
});

test("accounts and consumption survive an actual backend process restart", async () => {
  const uri = new URL(process.env.MONGO_URI);
  uri.pathname = `/${testDb}`;
  const count = await Consumption.countDocuments();
  for (let restart = 0; restart < 2; restart++) {
    const child = spawn(process.execPath, ["server.js"], {
      env: { ...process.env, MONGO_URI: uri.href, PORT: "5002" },
      windowsHide: true,
      stdio: "pipe",
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    try {
      for (
        let attempt = 0;
        attempt < 50 && !output.includes("Water portal API:");
        attempt++
      ) {
        if (child.exitCode !== null) assert.fail(output);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.match(output, /Water portal API:/);
      const response = await fetch("http://localhost:5002/api/consumption", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).length, count);
    } finally {
      if (child.exitCode === null) {
        const stopped = once(child, "exit");
        child.kill();
        await stopped;
      }
    }
  }
});

test("startup rejects invalid configuration and explains occupied ports", async () => {
  const run = async (overrides) => {
    const child = spawn(process.execPath, ["server.js"], {
      env: { ...process.env, ...overrides },
      windowsHide: true,
      stdio: "pipe",
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const timeout = setTimeout(() => child.kill(), 15000);
    const [code] = await once(child, "exit");
    clearTimeout(timeout);
    assert.equal(code, 1);
    return output;
  };
  assert.match(await run({ PORT: "invalid" }), /PORT must be a number/);
  assert.match(
    await run({ FRONTEND_URL: "not-an-origin" }),
    /CLIENT_ORIGIN must be an HTTP/,
  );
  const wrongDatabase = new URL(process.env.MONGO_URI);
  wrongDatabase.pathname = "/development";
  assert.match(
    await run({ MONGO_URI: wrongDatabase.href }),
    /MONGO_URI must use the smart_water_portal database/,
  );
  const occupied = createServer();
  occupied.listen(0, "0.0.0.0");
  await once(occupied, "listening");
  try {
    const uri = new URL(process.env.MONGO_URI);
    uri.pathname = `/${testDb}`;
    assert.match(
      await run({ PORT: String(occupied.address().port), MONGO_URI: uri.href }),
      /already in use.*Stop the other backend/,
    );
  } finally {
    await new Promise((resolve) => occupied.close(resolve));
  }
});
