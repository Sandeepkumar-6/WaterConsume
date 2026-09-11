import { Area, Consumption, Alert } from "../models/index.js";
import { areaScope } from "../middleware/auth.js";
import { today, dateRange, id, choice } from "../utils/validation.js";
import { limitStatus, recommendations } from "./limits.js";
const sum = (rows) => rows.reduce((n, r) => n + r.amount, 0);
function group(rows, key) {
  const result = new Map();
  for (const r of rows) {
    const k = key(r);
    result.set(k, (result.get(k) || 0) + r.amount);
  }
  return [...result]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, amount]) => ({ name, amount }));
}
export async function dataset(user, query = {}) {
  if (query.area) id(query.area);
  const scope = areaScope(user, query.area);
  const filter = { ...scope };
  const range = dateRange(query);
  if (Object.keys(range).length) filter.date = range;
  const areas = await Area.find(
    scope.area !== undefined ? { _id: scope.area } : {},
  )
    .sort({ name: 1 })
    .lean();
  const rows = await Consumption.find(filter).lean();
  return { areas, rows, scope };
}
export function areaLimits(areas, rows, current = today()) {
  return areas.map((a) => {
    const own = rows.filter((r) => String(r.area) === String(a._id));
    const daily = sum(own.filter((r) => r.date === current));
    const monthly = sum(
      own.filter((r) => r.date.startsWith(current.slice(0, 7))),
    );
    const dailyStatus = limitStatus(daily, a.dailyLimit);
    const monthlyStatus = limitStatus(monthly, a.monthlyLimit);
    const status = [dailyStatus, monthlyStatus].includes("EXCEEDED")
      ? "EXCEEDED"
      : [dailyStatus, monthlyStatus].includes("WARNING")
        ? "WARNING"
        : "NORMAL";
    return {
      area: a._id,
      name: a.name,
      daily,
      monthly,
      dailyLimit: a.dailyLimit,
      monthlyLimit: a.monthlyLimit,
      dailyStatus,
      monthlyStatus,
      status,
      recommendation: recommendations[status],
      active: a.status === "ACTIVE",
    };
  });
}
export async function dashboard(user) {
  const { areas, rows, scope } = await dataset(user);
  const current = today();
  const limits = areaLimits(areas, rows);
  const activeLimits = limits.filter((a) => a.active);
  return {
    summary: {
      total: sum(rows),
      today: sum(rows.filter((r) => r.date === current)),
      monthly: sum(rows.filter((r) => r.date.startsWith(current.slice(0, 7)))),
      areas: areas.filter((a) => a.status === "ACTIVE").length,
      exceeded: activeLimits.filter((a) => a.status === "EXCEEDED").length,
      alerts: await Alert.countDocuments({
        ...scope,
        status: { $ne: "RESOLVED" },
      }),
    },
    dailyConsumption: group(rows, (r) => r.date).slice(-30),
    monthlyConsumption: group(rows, (r) => r.date.slice(0, 7)).slice(-12),
    areaConsumption: areas.map((a) => ({
      name: a.name,
      amount: sum(rows.filter((r) => String(r.area) === String(a._id))),
    })),
    limitStatus: ["NORMAL", "WARNING", "EXCEEDED"].map((name) => ({
      name,
      amount: activeLimits.filter((a) => a.status === name).length,
    })),
    limits,
    asOf: current,
  };
}
export async function report(user, query) {
  const { areas, rows } = await dataset(user, query);
  if (query.status)
    choice(
      query.status,
      ["NORMAL", "WARNING", "EXCEEDED"],
      "consumption status",
    );
  const dailyRows = [];
  for (const area of areas)
    for (const g of group(
      rows.filter((r) => String(r.area) === String(area._id)),
      (r) => r.date,
    )) {
      dailyRows.push({
        area: area._id,
        name: area.name,
        date: g.name,
        amount: g.amount,
        limit: area.dailyLimit,
        status: limitStatus(g.amount, area.dailyLimit),
      });
    }
  const filtered = query.status
    ? dailyRows.filter((r) => r.status === query.status)
    : dailyRows;
  const comparisons = areas
    .map((a) => ({
      name: a.name,
      amount: sum(filtered.filter((r) => String(r.area) === String(a._id))),
      count: filtered.filter((r) => String(r.area) === String(a._id)).length,
    }))
    .filter((a) => a.count)
    .sort((a, b) => b.amount - a.amount);
  const total = sum(filtered);
  return {
    summary: {
      total,
      average: filtered.length ? total / filtered.length : 0,
      highest: comparisons[0]?.name || "—",
      lowest: comparisons.at(-1)?.name || "—",
      violations: filtered.filter((r) => r.status === "EXCEEDED").length,
    },
    rows: filtered.sort((a, b) => b.date.localeCompare(a.date)),
    areaConsumption: comparisons,
    generatedAt: new Date().toISOString(),
  };
}
export async function monitoring(user, query) {
  const view = choice(
    query.view || "Daily",
    ["Daily", "Weekly", "Monthly"],
    "view",
  );
  const { areas, rows } = await dataset(user, query);
  const trend = group(rows, (r) => {
    if (view === "Monthly") return r.date.slice(0, 7);
    if (view === "Weekly") {
      const d = new Date(`${r.date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    }
    return r.date;
  });
  const values = trend.map((r) => r.amount);
  const total = sum(rows);
  const historical = await report(user, query);
  return {
    summary: {
      total,
      average: values.length ? total / values.length : 0,
      minimum: values.length ? Math.min(...values) : 0,
      maximum: values.length ? Math.max(...values) : 0,
    },
    trend,
    limitRows: historical.rows,
    view,
    areas: areas.length,
  };
}
