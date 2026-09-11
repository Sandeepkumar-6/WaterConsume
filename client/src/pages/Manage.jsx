import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Pencil, Power, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { api } from "../services/api";
import {
  PageHeading,
  PasswordField,
  DataTable,
  StatusBadge,
  Loading,
  ErrorState,
  Modal,
  ConfirmationModal,
  Field,
} from "../components/UI";
import Filters from "../components/Filters";
import ConservationNote from "../components/ConservationNote";
import { number, today, displayDate } from "../utils/format";
const settings = {
  areas: {
    title: "Areas & limits",
    description: "Organize campus buildings and set responsible water budgets.",
    singular: "area",
  },
  users: {
    title: "Team members",
    description: "Manage portal access and assign staff to campus areas.",
    singular: "user",
  },
  consumption: {
    title: "Consumption records",
    description:
      "A shared record of every litre. Add, review, and track daily water use.",
    singular: "consumption",
  },
};
export default function Manage({ kind }) {
  const { user } = useAuth();
  const config = settings[kind];
  const isAdmin = user.role === "ADMIN";
  const [filters, setFilters] = useState({}),
    [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const resource = useApi(`/${kind}`, filters);
  const areas = useApi("/areas");
  const users = useApi(kind === "areas" ? "/users" : null);
  useEffect(() => {
    setFilters({});
    setEdit(null);
    setNotice("");
  }, [kind]);
  useEffect(() => {
    if (searchParams.get("add") === "1" && kind === "consumption") {
      setEdit({});
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, kind, setSearchParams]);
  const open = (row) => {
    setError("");
    setEdit(row);
  };
  const save = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const updating = !!edit._id;
      if (updating) await api.put(`/${kind}/${edit._id}`, body);
      else await api.post(`/${kind}`, body);
      setEdit(null);
      const label =
        config.singular === "consumption"
          ? "Consumption record"
          : config.singular === "area"
            ? "Area"
            : "User";
      setNotice(`${label} ${updating ? "updated" : "created"} successfully.`);
      resource.reload();
      areas.reload();
      if (kind === "areas") users.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const destroy = async () => {
    setBusy(true);
    setError("");
    try {
      const row = remove.row;
      if (remove.action === "status")
        await api.patch(`/${kind}/${row._id}/status`, {
          status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        });
      else if (remove.action === "permanent")
        await api.delete(`/${kind}/${row._id}/permanent`);
      else await api.delete(`/${kind}/${row._id}`);
      setRemove(null);
      if (kind === "consumption")
        setNotice("Consumption record deleted successfully.");
      else if (remove.action === "permanent")
        setNotice(
          `${config.singular === "area" ? "Area" : "User"} deleted successfully.`,
        );
      else
        setNotice(
          `${config.singular === "area" ? "Area" : "User"} ${row.status === "ACTIVE" ? "deactivated" : "reactivated"} successfully.`,
        );
      resource.reload();
      areas.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const actions = {
    label: "Actions",
    render: (r) => (
      <div className="row-actions">
        <button
          className="icon-button"
          aria-label={`Edit ${r.name || "consumption record"}`}
          onClick={() => open(r)}
        >
          <Pencil size={16} />
        </button>
        {kind !== "consumption" && (
          <button
            className="icon-button"
            disabled={kind === "users" && r._id === user._id}
            aria-label={`${r.status === "ACTIVE" ? "Deactivate" : "Reactivate"} ${r.name}`}
            onClick={() => {
              setError("");
              setRemove({ row: r, action: "status" });
            }}
          >
            {r.status === "ACTIVE" ? (
              <Power size={16} />
            ) : (
              <RotateCcw size={16} />
            )}
          </button>
        )}
        <button
          className="icon-button delete"
          disabled={kind === "users" && r._id === user._id}
          aria-label={`Delete ${r.name || "consumption record"}`}
          onClick={() => {
            setError("");
            setRemove({
              row: r,
              action: kind === "consumption" ? "delete" : "permanent",
            });
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    ),
  };
  const columns =
    kind === "areas"
      ? [
          {
            label: "Area",
            render: (r) => (
              <>
                <strong>{r.name}</strong>
                <small className="table-sub">
                  {r.code} · {r.location}
                </small>
              </>
            ),
          },
          {
            label: "Responsible staff",
            render: (r) => r.responsibleStaff?.name || "Unassigned",
          },
          { label: "Daily limit", render: (r) => `${number(r.dailyLimit)} L` },
          {
            label: "Monthly limit",
            render: (r) => `${number(r.monthlyLimit)} L`,
          },
          { label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          actions,
        ]
      : kind === "users"
        ? [
            {
              label: "Team member",
              render: (r) => (
                <>
                  <strong>{r.name}</strong>
                  <small className="table-sub">{r.email}</small>
                </>
              ),
            },
            { label: "Role", render: (r) => <StatusBadge status={r.role} /> },
            {
              label: "Assigned area",
              render: (r) => r.assignedArea?.name || "—",
            },
            {
              label: "Status",
              render: (r) => <StatusBadge status={r.status} />,
            },
            actions,
          ]
        : [
            {
              label: "Area",
              render: (r) => <strong>{r.area?.name || "Deleted area"}</strong>,
            },
            { label: "Date", render: (r) => displayDate(r.date) },
            {
              label: "Consumption",
              render: (r) => (
                <strong>
                  {number(r.amount)} <span className="muted">L</span>
                </strong>
              ),
            },
            {
              label: "Recorded by",
              render: (r) => r.recordedBy?.name || "Deleted user",
            },
            {
              label: "Notes",
              render: (r) => (
                <span className="notes-cell">{r.notes || "—"}</span>
              ),
            },
            ...(isAdmin ? [actions] : []),
          ];
  return (
    <>
      <PageHeading title={config.title} description={config.description}>
        <button onClick={() => open({})}>
          <Plus size={18} />
          Add {config.singular}
        </button>
      </PageHeading>
      {kind === "consumption" && (
        <ConservationNote
          compact
          title="A careful record is a good place to start."
        >
          Record each reading once. Add a note when unusual use needs a closer
          look.
        </ConservationNote>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {areas.error && <ErrorState message={areas.error} retry={areas.reload} />}
      <section className="panel">
        {kind === "consumption" ? (
          <Filters
            filters={filters}
            setFilters={setFilters}
            areas={areas.data || []}
            search
          />
        ) : (
          <div className="filters">
            <Field
              label="Search"
              placeholder={`Search ${kind}…`}
              value={filters.search || ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, search: e.target.value }))
              }
            />
            <Field label="Status">
              <select
                value={filters.status || ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="">All statuses</option>
                <option>ACTIVE</option>
                <option>INACTIVE</option>
              </select>
            </Field>
            <button className="secondary" onClick={() => setFilters({})}>
              Reset
            </button>
          </div>
        )}
        <div className="panel-heading">
          <h2>
            {kind === "consumption" ? "Consumption history" : config.title}
          </h2>
          <span className="muted">{resource.data?.length || 0} records</span>
        </div>
        {resource.loading ? (
          <Loading />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : (
          <DataTable columns={columns} rows={resource.data || []} />
        )}
      </section>
      {edit && (
        <Modal
          title={`${edit._id ? "Edit" : "Add"} ${config.singular}`}
          close={busy ? () => {} : () => setEdit(null)}
        >
          <form onSubmit={save}>
            {error && <ErrorState message={error} />}
            <div className="form-grid">
              {kind === "areas" ? (
                <>
                  <Field
                    label="Area name"
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={edit.name}
                  />
                  <Field
                    label="Building code"
                    name="code"
                    required
                    maxLength={30}
                    defaultValue={edit.code}
                  />
                  <Field
                    label="Location"
                    name="location"
                    required
                    maxLength={200}
                    defaultValue={edit.location}
                  />
                  <Field label="Responsible staff">
                    <select
                      name="responsibleStaff"
                      defaultValue={edit.responsibleStaff?._id || ""}
                    >
                      <option value="">Unassigned</option>
                      {(users.data || [])
                        .filter(
                          (u) => u.role === "STAFF" && u.status === "ACTIVE",
                        )
                        .map((u) => (
                          <option key={u._id} value={u._id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field
                    label="Daily limit (Litres)"
                    name="dailyLimit"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    defaultValue={edit.dailyLimit}
                  />
                  <Field
                    label="Monthly limit (Litres)"
                    name="monthlyLimit"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    defaultValue={edit.monthlyLimit}
                  />
                  <input
                    type="hidden"
                    name="status"
                    value={edit.status || "ACTIVE"}
                  />
                  <p className="field-help">
                    Assigning responsible staff also gives them access to this
                    area. Staff can access one area at a time.
                  </p>
                </>
              ) : kind === "users" ? (
                <>
                  <Field
                    label="Full name"
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={edit.name}
                  />
                  <Field
                    label="Email address"
                    name="email"
                    type="email"
                    required
                    defaultValue={edit.email}
                  />
                  <PasswordField
                    label={
                      edit._id
                        ? "New password (leave blank to keep)"
                        : "Password"
                    }
                    name="password"
                    minLength={8}
                    autoComplete="new-password"
                    required={!edit._id}
                  />
                  <Field label="Role">
                    <select name="role" defaultValue={edit.role || "STAFF"}>
                      <option>STAFF</option>
                      <option>ADMIN</option>
                    </select>
                  </Field>
                  <Field label="Assigned area (staff only)">
                    <select
                      name="assignedArea"
                      defaultValue={edit.assignedArea?._id || ""}
                    >
                      <option value="">Unassigned</option>
                      {(areas.data || [])
                        .filter((a) => a.status === "ACTIVE")
                        .map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <input
                    type="hidden"
                    name="status"
                    value={edit.status || "ACTIVE"}
                  />
                </>
              ) : (
                <>
                  <Field label="Area">
                    <select
                      name="area"
                      required
                      defaultValue={
                        edit.area?._id ||
                        (areas.data?.length === 1 ? areas.data[0]._id : "")
                      }
                    >
                      <option value="" disabled>
                        Select an area
                      </option>
                      {(areas.data || [])
                        .filter(
                          (a) =>
                            a.status === "ACTIVE" || a._id === edit.area?._id,
                        )
                        .map((a) => (
                          <option
                            key={a._id}
                            value={a._id}
                            disabled={a.status !== "ACTIVE"}
                          >
                            {a.name}
                            {a.status !== "ACTIVE" ? " (inactive)" : ""}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field
                    label="Date"
                    type="date"
                    name="date"
                    required
                    defaultValue={edit.date || today()}
                  />
                  <Field
                    label="Water consumed (Litres)"
                    type="number"
                    name="amount"
                    min="0.01"
                    step="0.01"
                    required
                    defaultValue={edit.amount}
                  />
                  <Field label="Unit">
                    <select name="unit">
                      <option>Litres</option>
                    </select>
                  </Field>
                  <label className="field span-two">
                    <span>Notes (optional)</span>
                    <textarea
                      name="notes"
                      rows={3}
                      maxLength={1000}
                      defaultValue={edit.notes}
                      placeholder="Add context about this reading…"
                    />
                  </label>
                  <p className="field-help span-two">
                    Recorded by {edit.recordedBy?.name || user.name}. Multiple
                    entries on the same day are added together for limit checks.
                  </p>
                </>
              )}
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              <button
                disabled={
                  busy ||
                  areas.loading ||
                  !!areas.error ||
                  (kind === "areas" && (users.loading || !!users.error))
                }
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <ConfirmationModal
          title={
            remove.action === "status"
              ? `${remove.row.status === "ACTIVE" ? "Deactivate" : "Reactivate"} ${config.singular}?`
              : `Delete ${config.singular}?`
          }
          message={
            remove.action === "status" && kind === "areas"
              ? remove.row.status === "ACTIVE"
                ? `${remove.row.name} will stop accepting new consumption entries. Historical records remain available.`
                : `${remove.row.name} will accept new entries again. Staff must be reassigned separately.`
              : remove.action === "status" && kind === "users"
                ? remove.row.status === "ACTIVE"
                  ? `${remove.row.name} will no longer be able to sign in. Historical records remain linked to this account.`
                  : `${remove.row.name} will be able to sign in again. Assign an area separately if needed.`
                : kind === "areas"
                  ? "Delete this area permanently? If historical consumption exists, deletion will be refused and deactivation is recommended."
                  : kind === "users"
                    ? "Delete this user permanently? If historical records reference this account, deletion will be refused and deactivation is recommended."
                    : "Delete this consumption record? Totals and alerts will be recalculated."
          }
          confirm={destroy}
          close={() => setRemove(null)}
          busy={busy}
          error={error}
        />
      )}
    </>
  );
}
