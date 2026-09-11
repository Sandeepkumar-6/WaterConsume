import { Field } from "./UI";
export default function Filters({
  filters,
  setFilters,
  areas,
  search = false,
  status,
  view = false,
  dates = true,
}) {
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  return (
    <div className="filters">
      {search && (
        <Field
          label="Search"
          value={filters.search || ""}
          placeholder="Search records…"
          onChange={(e) => set("search", e.target.value)}
        />
      )}
      <Field label="Area">
        <select
          value={filters.area || ""}
          onChange={(e) => set("area", e.target.value)}
        >
          <option value="">All permitted areas</option>
          {areas.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      {dates && (
        <>
          <Field
            label="Start date"
            type="date"
            value={filters.startDate || ""}
            onChange={(e) => set("startDate", e.target.value)}
          />
          <Field
            label="End date"
            type="date"
            value={filters.endDate || ""}
            onChange={(e) => set("endDate", e.target.value)}
          />
        </>
      )}
      {status && (
        <Field label="Status">
          <select
            value={filters.status || ""}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {status.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      )}
      {view && (
        <Field label="View type">
          <select
            value={filters.view || "Daily"}
            onChange={(e) => set("view", e.target.value)}
          >
            {["Daily", "Weekly", "Monthly"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      )}
      <button className="secondary" onClick={() => setFilters({})}>
        Reset
      </button>
    </div>
  );
}
