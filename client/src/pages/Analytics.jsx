import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { useApi } from "../hooks/useApi";
import {
  PageHeading,
  StatCard,
  ChartCard,
  Loading,
  ErrorState,
  DataTable,
  StatusBadge,
} from "../components/UI";
import Filters from "../components/Filters";
import { number, displayDate, exportCsv } from "../utils/format";
export default function Analytics({ report = false }) {
  const [filters, setFilters] = useState({});
  const resource = useApi(report ? "/reports" : "/monitoring", filters);
  const areas = useApi("/areas");
  const data = resource.data;
  return (
    <>
      <PageHeading
        title={report ? "Consumption reports" : "Consumption monitoring"}
        description={
          report
            ? "Turn your campus records into clear, shareable reports."
            : "Follow consumption trends and understand changes over time."
        }
      >
        {report && (
          <>
            <button
              className="secondary"
              disabled={
                !data?.rows.length || resource.loading || !!resource.error
              }
              onClick={() => exportCsv(data.rows)}
            >
              <Download size={17} />
              Export CSV
            </button>
            <button
              disabled={!data || resource.loading || !!resource.error}
              onClick={() => window.print()}
            >
              <Printer size={17} />
              Print report
            </button>
          </>
        )}
      </PageHeading>
      {areas.error && <ErrorState message={areas.error} retry={areas.reload} />}
      <section className="panel">
        <Filters
          filters={filters}
          setFilters={setFilters}
          areas={areas.data || []}
          view={!report}
          status={report ? ["NORMAL", "WARNING", "EXCEEDED"] : undefined}
        />
      </section>
      <p className="analysis-note">
        {report
          ? "Report totals use area-day sums. Status filters compare each day with the current daily limit. Average = total ÷ recorded area-days; violations count exceeded area-days."
          : "Trend statistics use recorded periods only; days with no entries are not treated as zero. Weeks start Monday. Limit checks below use daily totals and current limits."}
      </p>
      <div className="print-only">
        Area:{" "}
        {areas.data?.find((a) => a._id === filters.area)?.name || "All areas"} ·
        Dates: {filters.startDate || "Beginning"} to{" "}
        {filters.endDate || "Latest"} · Status: {filters.status || "All"}
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        data && (
          <>
            <div
              className={`stats-grid ${report ? "report-stats" : "four-stats"}`}
            >
              <StatCard
                label="Total consumption"
                value={data.summary.total}
                unit="L"
              />
              <StatCard
                label={
                  report
                    ? "Average per area-day"
                    : `Average per ${(filters.view || "Daily").toLowerCase()} period`
                }
                value={data.summary.average}
                unit="L"
              />
              {report ? (
                <>
                  <StatCard
                    label="Highest consuming area"
                    value={data.summary.highest}
                  />
                  <StatCard
                    label="Lowest consuming area"
                    value={data.summary.lowest}
                  />
                  <StatCard
                    label="Daily limit violations"
                    value={data.summary.violations}
                    tone="coral"
                  />
                </>
              ) : (
                <>
                  <StatCard
                    label="Minimum period usage"
                    value={data.summary.minimum}
                    unit="L"
                  />
                  <StatCard
                    label="Maximum period usage"
                    value={data.summary.maximum}
                    unit="L"
                  />
                </>
              )}
            </div>
            <ChartCard
              title={report ? "Area comparison" : "Consumption trend"}
              subtitle={
                report
                  ? "Totals matching the selected filters"
                  : `${filters.view || "Daily"} totals matching the selected date range`
              }
              data={report ? data.areaConsumption : data.trend}
              type={report ? "bar" : "area"}
            />
            <section className="panel">
              <div className="panel-heading">
                <h2>{report ? "Detailed report" : "Daily limit checks"}</h2>
                {report && (
                  <span className="muted">
                    Generated{" "}
                    {new Date(data.generatedAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </span>
                )}
              </div>
              <DataTable
                rows={report ? data.rows : data.limitRows}
                columns={[
                  { label: "Area", key: "name" },
                  { label: "Date", render: (r) => displayDate(r.date) },
                  {
                    label: "Consumption",
                    render: (r) => `${number(r.amount)} L`,
                  },
                  {
                    label: "Daily limit",
                    render: (r) => `${number(r.limit)} L`,
                  },
                  {
                    label: "Status",
                    render: (r) => <StatusBadge status={r.status} />,
                  },
                ]}
              />
            </section>
          </>
        )
      )}
    </>
  );
}
