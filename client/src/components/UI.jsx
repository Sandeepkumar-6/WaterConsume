import {
  useEffect,
  useRef,
  useId,
  useState,
  cloneElement,
  lazy,
  Suspense,
} from "react";
import {
  Droplets,
  X,
  Inbox,
  AlertCircle,
  LoaderCircle,
  CircleCheck,
  TriangleAlert,
  CircleAlert,
  Circle,
  Eye,
  EyeOff,
} from "lucide-react";

import { number } from "../utils/format";
export function Loading() {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" /> Loading portal data…
    </div>
  );
}
export function EmptyState({
  message = "No records found. Try changing your filters or add a new record.",
}) {
  return (
    <div className="state">
      <Inbox size={30} />
      <p>{message}</p>
    </div>
  );
}
export function ErrorState({ message, retry }) {
  return (
    <div className="error" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
      {retry && (
        <button className="secondary" onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
export function StatusBadge({ status }) {
  const Icon = ["NORMAL", "ACTIVE", "RESOLVED"].includes(status)
    ? CircleCheck
    : ["WARNING", "READ"].includes(status)
      ? TriangleAlert
      : ["EXCEEDED", "UNREAD", "INACTIVE"].includes(status)
        ? CircleAlert
        : Circle;
  return (
    <span className={`badge ${status?.toLowerCase()}`}>
      <Icon size={13} aria-hidden="true" />
      {status?.replaceAll("_", " ")}
    </span>
  );
}
export function PasswordField({ label = "Password", ...props }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input {...props} id={id} type={visible ? "text" : "password"} />
        <button
          type="button"
          className="icon-button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
export function StatCard({
  label,
  value,
  unit,
  icon: Icon = Droplets,
  note,
  tone = "teal",
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={19} />
        </span>
      </div>
      <div className="stat-value">
        {typeof value === "number" ? number(value) : value}
        <small>{unit}</small>
      </div>
      {note && <p>{note}</p>}
    </div>
  );
}
export function DataTable({ columns, rows, empty }) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r._id || (r.area ? `${r.area}-${r.date || ""}` : i)}>
              {columns.map((c) => (
                <td key={c.label}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState message={empty} />
  );
}
export function Modal({ title, children, close }) {
  const dialog = useRef();
  const titleId = useId();
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ConfirmationModal({
  title,
  message,
  confirm,
  close,
  busy,
  error,
}) {
  return (
    <Modal title={title} close={busy ? () => {} : close}>
      <p className="muted">{message}</p>
      {error && <ErrorState message={error} />}
      <div className="form-actions">
        <button className="secondary" disabled={busy} onClick={close}>
          Cancel
        </button>
        <button className="danger" disabled={busy} onClick={confirm}>
          {busy ? "Working…" : "Confirm"}
        </button>
      </div>
    </Modal>
  );
}
export function PageHeading({
  eyebrow = "CAMPUS WATER MANAGEMENT",
  title,
  description,
  children,
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
const LazyChart = lazy(() => import("./ChartCard"));
export function ChartCard(props) {
  return (
    <Suspense fallback={<Loading />}>
      <LazyChart {...props} />
    </Suspense>
  );
}
export function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? cloneElement(children, { id }) : <input id={id} {...props} />}
    </div>
  );
}
