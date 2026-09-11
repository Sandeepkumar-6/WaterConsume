import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout, { ProtectedRoute, RoleRoute } from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Manage from "./pages/Manage";
import Analytics from "./pages/Analytics";
import Alerts from "./pages/Alerts";
import Profile from "./pages/Profile";
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Login key="register" register />} />
          <Route path="/login" element={<Login key="login" />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route
                path="/consumption"
                element={<Manage key="consumption" kind="consumption" />}
              />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/profile" element={<Profile />} />
              <Route element={<RoleRoute />}>
                <Route
                  path="/areas"
                  element={<Manage key="areas" kind="areas" />}
                />
                <Route
                  path="/users"
                  element={<Manage key="users" kind="users" />}
                />
                <Route
                  path="/monitoring"
                  element={<Analytics key="monitoring" />}
                />
                <Route
                  path="/reports"
                  element={<Analytics key="reports" report />}
                />
              </Route>
            </Route>
          </Route>
          <Route
            path="*"
            element={
              <div className="state">
                <h1>Page not found</h1>
                <Link to="/dashboard">Return to dashboard</Link>
              </div>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
