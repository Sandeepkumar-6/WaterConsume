export const number = (value) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(
    value || 0,
  );
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export const displayDate = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function exportCsv(rows) {
  const cell = (v) => {
    const s = String(v ?? "");
    return `"${(/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""')}"`;
  };
  const csv = [
    ["Area", "Date", "Consumption (L)", "Daily limit (L)", "Status"],
    ...rows.map((r) => [r.name, r.date, r.amount, r.limit, r.status]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `water-report-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
