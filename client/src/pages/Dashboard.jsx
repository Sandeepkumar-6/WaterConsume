import { Link } from "react-router-dom";
import {
  Plus,
  ArrowUpRight,
  Droplets,
  CalendarDays,
  Building2,
  TriangleAlert,
  Bell,
  Leaf,
} from "lucide-react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import {
  PageHeading,
  StatCard,
  ChartCard,
  DataTable,
  StatusBadge,
  Loading,
  ErrorState,
  EmptyState,
} from "../components/UI";
import { number, displayDate } from "../utils/format";
import ConservationNote from "../components/ConservationNote";
export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi("/dashboard");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={reload} />;
  const s = data.summary;
  return (
    <>
      <PageHeading
        title="Water overview"
        description="A shared view of campus water use. Monitor responsibly, conserve together."
      >
        <Link className="button" to="/consumption?add=1">
          <Plus size={18} />
          Add consumption
        </Link>
      </PageHeading>
      <ConservationNote compact />
      <div className="stats-grid">
        <StatCard
          label="Total water consumed"
          value={s.total}
          unit="L"
          note="Across all recorded dates"
        />
        <StatCard
          label="Today's consumption"
          value={s.today}
          unit="L"
          icon={Droplets}
          note={`Recorded for ${displayDate(data.asOf)}`}
        />
        <StatCard
          label="This month's usage"
          value={s.monthly}
          unit="L"
          icon={CalendarDays}
          note="Calendar month to date"
        />
        <StatCard
          label="Active areas"
          value={s.areas}
          icon={Building2}
          note="Buildings being monitored"
          tone="blue"
        />
        <StatCard
          label="Areas over limit"
          value={s.exceeded}
          icon={TriangleAlert}
          note="Today or current month"
          tone="amber"
        />
        <StatCard
          label="Active alerts"
          value={s.alerts}
          icon={Bell}
          note="Unread and read alerts"
          tone="coral"
        />
      </div>
      <div className="section-heading">
        <h2>Consumption at a glance</h2>
        {user.role === "ADMIN" && (
          <Link to="/monitoring">
            Explore monitoring <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      <div className="charts-grid">
        <ChartCard
          title="Daily consumption"
          subtitle="Usage across the latest 30 recorded days"
          data={data.dailyConsumption}
        />
        <ChartCard
          title="Consumption by area"
          subtitle="Compare total usage across campus buildings"
          data={data.areaConsumption}
          type="bar"
        />
      </div>
      <div className="charts-grid secondary-charts">
        <ChartCard
          title="Monthly consumption"
          subtitle="Recorded calendar-month totals"
          data={data.monthlyConsumption}
          type="bar"
        />
        <ChartCard
          title="Current limit status"
          subtitle="Active areas · daily and monthly limits"
          data={data.limitStatus}
          type="pie"
          unit="areas"
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Area health</h2>
            <p>
              Today's usage and current calendar month against configured limits
            </p>
          </div>
          <span className="chart-unit">{data.limits.length} AREAS</span>
        </div>
        <DataTable
          rows={data.limits}
          columns={[
            {
              label: "Area",
              render: (r) => (
                <strong>
                  {r.name}
                  {!r.active && <small className="muted"> · Inactive</small>}
                </strong>
              ),
            },
            {
              label: "Today / daily limit",
              render: (r) => (
                <>
                  {number(r.daily)}{" "}
                  <span className="muted">/ {number(r.dailyLimit)} L</span>
                  <div className="progress">
                    <i
                      style={{
                        width: `${Math.min(100, (r.daily / r.dailyLimit) * 100)}%`,
                        background:
                          r.dailyStatus === "EXCEEDED" ? "#e87b6f" : "#1b9c91",
                      }}
                    />
                  </div>
                </>
              ),
            },
            {
              label: "Month / monthly limit",
              render: (r) =>
                `${number(r.monthly)} / ${number(r.monthlyLimit)} L`,
            },
            {
              label: "Status",
              render: (r) => <StatusBadge status={r.status} />,
            },
          ]}
        />
      </section>
      <section className="recommendations">
        <div className="section-heading">
          <h2>
            <Leaf size={20} /> Conservation recommendations
          </h2>
          <span className="muted">Based on configured limits</span>
        </div>
        {data.limits.length ? (
          <div className="recommendation-grid">
            {data.limits.map((r) => (
              <div
                className={`recommendation ${r.status.toLowerCase()}`}
                key={r.area}
              >
                <div>
                  <strong>{r.name}</strong>
                  <StatusBadge status={r.status} />
                </div>
                <p>{r.recommendation}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Assign an area to see usage and recommendations." />
        )}
      </section>
    </>
  );
}
