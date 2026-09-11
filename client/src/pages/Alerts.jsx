import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import {
  PageHeading,
  Loading,
  ErrorState,
  EmptyState,
  StatusBadge,
} from "../components/UI";
import Filters from "../components/Filters";
import { number } from "../utils/format";
import ConservationNote from "../components/ConservationNote";
export default function Alerts() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({}),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const resource = useApi("/alerts", filters);
  const areas = useApi("/areas");
  const update = async (id, status) => {
    setBusy(id);
    setError("");
    try {
      await api.patch(`/alerts/${id}/status`, { status });
      resource.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <PageHeading
        title="Water usage alerts"
        description="Know when limits are exceeded and keep follow-up actions visible."
      />
      <ConservationNote
        compact
        title="An alert is a reason to take a closer look."
      >
        Review unusual consumption and check for running taps or possible leaks.
        A limit alert alone does not confirm a leak.
      </ConservationNote>
      <section className="panel">
        <Filters
          filters={filters}
          setFilters={setFilters}
          areas={areas.data || []}
          dates={false}
          status={["UNREAD", "READ", "RESOLVED"]}
        />
      </section>
      {areas.error && <ErrorState message={areas.error} retry={areas.reload} />}
      {error && <ErrorState message={error} />}
      <p className="analysis-note">
        One alert per area, type, and period. Corrected records automatically
        resolve alerts when usage falls within the limit. Manual resolution
        records a review; it does not change consumption.
      </p>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data.length ? (
        <EmptyState message="No alerts match these filters." />
      ) : (
        <div className="alert-list">
          {resource.data.map((a) => (
            <article
              className={`panel alert-card ${a.status === "RESOLVED" ? "resolved-card" : ""}`}
              key={a._id}
            >
              <span className="alert-icon">
                {a.status === "RESOLVED" ? <CheckCheck /> : <Bell />}
              </span>
              <div className="alert-body">
                <div className="alert-title">
                  <h2>
                    {a.area?.name || "Area"} · {a.type.toLowerCase()} limit
                  </h2>
                  <StatusBadge status={a.status} />
                </div>
                <p>{a.message}</p>
                <div className="alert-meta">
                  <span>
                    <strong>{number(a.consumption)} L</strong> consumed
                  </span>
                  <span>Limit: {number(a.limit)} L</span>
                  <span>Period: {a.period}</span>
                </div>
                {a.resolvedAt && (
                  <small className="muted">
                    Resolved{" "}
                    {new Date(a.resolvedAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                    {a.autoResolved
                      ? " automatically after recalculation"
                      : ` by ${a.resolvedBy?.name || "an administrator"}`}
                  </small>
                )}
              </div>
              {user.role === "ADMIN" && a.status !== "RESOLVED" && (
                <div className="alert-actions">
                  {a.status === "UNREAD" && (
                    <button
                      className="secondary"
                      disabled={!!busy}
                      onClick={() => update(a._id, "READ")}
                    >
                      Mark read
                    </button>
                  )}
                  {a.status === "READ" && (
                    <button
                      className="secondary"
                      disabled={!!busy}
                      onClick={() => update(a._id, "UNREAD")}
                    >
                      Mark unread
                    </button>
                  )}
                  <button
                    disabled={!!busy}
                    onClick={() => update(a._id, "RESOLVED")}
                  >
                    {busy === a._id ? "Updating…" : "Resolve"}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
