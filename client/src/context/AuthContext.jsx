import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { api } from "../services/api";
import { ErrorState, Loading } from "../components/UI";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(null);
  const logout = useCallback(() => {
    pending.current?.abort();
    sessionStorage.removeItem("water-token");
    setUser(null);
    setError("");
    setLoading(false);
  }, []);
  useEffect(() => {
    window.addEventListener("water-logout", logout);
    return () => window.removeEventListener("water-logout", logout);
  }, [logout]);
  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
    setError("");
    if (sessionStorage.getItem("water-token")) {
      setLoading(true);
      api
        .get("/auth/me", { signal: controller.signal })
        .then((r) => {
          if (!controller.signal.aborted) setUser(r.data);
        })
        .catch((err) => {
          if (!controller.signal.aborted) setError(err.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    } else setLoading(false);
    return () => controller.abort();
  }, [attempt]);
  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    sessionStorage.setItem("water-token", data.token);
    setUser(data.user);
  };
  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {loading ? (
        <Loading />
      ) : error ? (
        <div className="state">
          <h1>Unable to restore your session</h1>
          <ErrorState
            message={error}
            retry={() => setAttempt((value) => value + 1)}
          />
          <button className="secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
