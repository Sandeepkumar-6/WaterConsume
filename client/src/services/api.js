import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 15000,
});
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("water-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config.url.includes("/auth/login")
    ) {
      sessionStorage.removeItem("water-token");
      window.dispatchEvent(new Event("water-logout"));
    }
    error.message =
      error.response?.data?.message ||
      (error.code === "ECONNABORTED"
        ? "The server took too long to respond. Please retry."
        : "Unable to connect to server. Check that the backend is running and the configured API address is correct.");
    return Promise.reject(error);
  },
);
