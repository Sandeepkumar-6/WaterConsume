import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Droplets,
  ShieldCheck,
  Leaf,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Field, PasswordField, ErrorState } from "../components/UI";
import { api } from "../services/api";
import campusConservation from "../assets/campus-water-conservation.svg";

export default function Login({ register = false }) {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [role, setRole] = useState("STAFF");
  if (user) return <Navigate to="/dashboard" replace />;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(e.currentTarget);
    try {
      if (register) {
        if (form.get("password") !== form.get("confirmPassword"))
          throw new Error("Passwords must match.");
        await api.post("/auth/register", Object.fromEntries(form));
        e.target.reset();
        setNotice("Account created. You can now sign in.");
      } else {
        await login(form.get("email"), form.get("password"));
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <section className="login-story">
        <Link className="brand" to="/">
          <span className="brand-icon">
            <Droplets />
          </span>
          <span>
            smart<span className="brand-water">water</span>
            <small>CAMPUS WATER CONSERVATION</small>
          </span>
        </Link>
        <div className="login-story-body">
          <span className="eyebrow">FOR A MORE WATER-WISE CAMPUS</span>
          <h1>
            Good records.
            <br />
            Better water habits.
          </h1>
          <p>Understand usage. Notice waste. Conserve together.</p>
          <img
            src={campusConservation}
            width="720"
            height="600"
            alt="Turning off a tap at an Indian college campus water point"
          />
        </div>
        <div className="login-story-footer">
          <Leaf size={17} />
          <span>Small actions today. A sustainable campus tomorrow.</span>
        </div>
      </section>
      <section className="login-side">
        <Link className="back-link" to="/">
          <ArrowLeft size={16} />
          Back to the portal
        </Link>
        <form className="login-form" onSubmit={submit}>
          <span className="login-lock">
            <ShieldCheck size={26} />
          </span>
          <span className="eyebrow">YOUR CAMPUS WORKSPACE</span>
          <h1>{register ? "Create your account" : "Welcome back"}</h1>
          <p className="muted">
            {register
              ? "Join your institution's water conservation portal."
              : "Sign in to manage water with confidence."}
          </p>
          {error && <ErrorState message={error} />}
          {notice && (
            <div className="notice" role="status">
              {notice} <Link to="/login">Sign in</Link>
            </div>
          )}
          {register && (
            <Field
              label="Name"
              name="name"
              required
              maxLength={100}
              autoComplete="name"
            />
          )}
          <Field
            label="Email address"
            type="email"
            name="email"
            placeholder="you@institution.edu.in"
            autoComplete="username"
            required
          />
          <PasswordField
            label="Password"
            name="password"
            placeholder="Enter your password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 8 : undefined}
            required
          />
          {register && (
            <>
              <PasswordField
                label="Confirm password"
                name="confirmPassword"
                autoComplete="new-password"
                required
                minLength={8}
              />
              <Field label="Role">
                <select
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="STAFF">Staff</option>
                  {import.meta.env.DEV && (
                    <option value="ADMIN">Administrator</option>
                  )}
                </select>
              </Field>
              {role === "STAFF" && (
                <p className="access-help">
                  An administrator will assign your building after registration.
                </p>
              )}
            </>
          )}
          <button disabled={busy} className="full">
            {busy ? "Please wait..." : register ? "Register" : "Sign in"}
            <ArrowRight size={18} />
          </button>
          <p className="access-help">
            {register ? (
              <>
                Already registered? <Link to="/login">Sign in</Link>
              </>
            ) : (
              <>
                Need an account? <Link to="/register">Register</Link>
              </>
            )}
          </p>
        </form>
        <span className="login-footer">
          Smart Water Consumption &amp; Conservation Portal
        </span>
      </section>
    </div>
  );
}
