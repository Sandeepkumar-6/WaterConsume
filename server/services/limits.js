import { Area, Consumption, Alert } from "../models/index.js";
export function limitStatus(amount, limit) {
  return amount > limit
    ? "EXCEEDED"
    : amount >= limit * 0.9
      ? "WARNING"
      : "NORMAL";
}
export const recommendations = {
  NORMAL:
    "Water consumption is currently within the configured limit. Continue regular checks and record usage each day.",
  WARNING:
    "Consumption is approaching the configured limit. Consider reducing non-essential water usage.",
  EXCEEDED:
    "Water consumption is above the configured limit. Check for leakage or unnecessary water usage.",
};
// Serialize writes within this local server so a later alert recalculation cannot be overwritten by an earlier one.
let queue = Promise.resolve();
export function serializeMutation(work) {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}
export async function recalculateAlerts(areaId) {
  const area = await Area.findById(areaId);
  if (!area) return;
  const records = await Consumption.find({ area: areaId }).lean();
  const periods = new Map();
  for (const r of records)
    for (const [type, period] of [
      ["DAILY", r.date],
      ["MONTHLY", r.date.slice(0, 7)],
    ]) {
      const key = `${type}:${period}`;
      periods.set(key, (periods.get(key) || 0) + r.amount);
    }
  const existing = await Alert.find({ area: areaId });
  for (const alert of existing)
    if (!periods.has(`${alert.type}:${alert.period}`))
      periods.set(`${alert.type}:${alert.period}`, 0);
  for (const [key, amount] of periods) {
    const [type, period] = key.split(":");
    const limit = type === "DAILY" ? area.dailyLimit : area.monthlyLimit;
    const old = existing.find((a) => a.type === type && a.period === period);
    if (amount > limit) {
      const changes = {
        consumption: amount,
        limit,
        message: `${area.name} exceeded its ${type.toLowerCase()} water limit for ${period}.`,
      };
      if (old?.autoResolved)
        Object.assign(changes, {
          status: "UNREAD",
          autoResolved: false,
          resolvedAt: null,
          resolvedBy: null,
        });
      await Alert.findOneAndUpdate(
        { area: areaId, type, period },
        { $set: changes, $setOnInsert: { area: areaId, type, period } },
        { upsert: true, runValidators: true },
      );
    } else if (old) {
      old.consumption = amount;
      old.limit = limit;
      if (old.status !== "RESOLVED") {
        old.status = "RESOLVED";
        old.autoResolved = true;
        old.resolvedAt = new Date();
        old.resolvedBy = null;
      }
      await old.save();
    }
  }
}
