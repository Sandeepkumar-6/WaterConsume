import { NavLink, Outlet, Navigate, Link } from "react-router-dom";
import { useState } from "react";
import {
  Droplets,
  LayoutDashboard,
  Building2,
  Gauge,
  Activity,
  Bell,
  FileChartColumn,
  Users,
  UserRound,
  LogOut,
  Menu,
  ChevronRight,
  Leaf,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Loading } from "./UI";
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  return loading ? (
    <Loading />
  ) : user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace />
  );
}
export function RoleRoute() {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" replace />
  );
}
const links = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/consumption", "Consumption", Gauge],
  ["/monitoring", "Monitoring", Activity, true],
  ["/areas", "Areas & limits", Building2, true],
  ["/alerts", "Alerts", Bell],
  ["/reports", "Reports", FileChartColumn, true],
  ["/users", "Team members", Users, true],
  ["/profile", "My profile", UserRound],
];
export function Sidebar({ open, close }) {
  const { user, logout } = useAuth();
  return (
    <>
      <div
        className={`sidebar-backdrop ${open ? "show" : ""}`}
        onClick={close}
      />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" to="/dashboard">
          <span className="brand-icon">
            <Droplets size={25} />
          </span>
          <span>
            smart<span className="brand-water">water</span>
            <small>CAMPUS WATER CONSERVATION</small>
          </span>
        </Link>
        <div className="workspace">
          <span className="campus-icon">
            <Building2 size={20} />
          </span>
          <div>
            Institution workspace
            <small>Water monitoring &amp; conservation</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <span className="nav-label">CAMPUS MANAGEMENT</span>
        <nav>
          {links
            .filter((l) => !l[3] || user.role === "ADMIN")
            .map(([to, label, Icon]) => (
              <NavLink onClick={close} key={to} to={to}>
                <Icon size={19} />
                {label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="conserve">
            <Leaf size={21} />
            <strong>Every drop counts.</strong>
            <p>
              Small actions today.
              <br />A water-wise campus tomorrow.
            </p>
          </div>
          <button className="logout" onClick={logout}>
            <LogOut size={18} />
            Sign out
          </button>
          <span className="local-note">Record. Review. Conserve.</span>
        </div>
      </aside>
    </>
  );
}
export function Navbar({ toggle }) {
  const { user } = useAuth();
  return (
    <header className="navbar">
      <div>
        <button
          className="icon-button mobile-menu"
          aria-label="Toggle navigation"
          onClick={toggle}
        >
          <Menu />
        </button>
        <span className="breadcrumb">
          Campus portal <ChevronRight size={14} />{" "}
          <strong>Water management</strong>
        </span>
      </div>
      <div className="header-right">
        <span className="today">
          {new Date().toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <Link
          className="icon-button notification"
          to="/alerts"
          aria-label="View alerts"
        >
          <Bell size={20} />
        </Link>
        <Link className="user-chip" to="/profile">
          <span className="avatar">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <span>
            {user.name}
            <small>
              {user.role === "ADMIN" ? "Administrator" : "Staff member"}
            </small>
          </span>
        </Link>
      </div>
    </header>
  );
}
export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <Sidebar open={open} close={() => setOpen(false)} />
      <div className="main-shell">
        <Navbar toggle={() => setOpen(!open)} />
        <main>
          <Outlet />
        </main>
        <footer>
          Smart Water Consumption Portal{" "}
          <span>Record responsibly. Conserve together.</span>
        </footer>
      </div>
    </div>
  );
}
