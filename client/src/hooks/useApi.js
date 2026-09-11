import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
export function useApi(path, params = {}) {
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const key = JSON.stringify(params);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError("");
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const response = await api.get(path, { params: JSON.parse(key) });
      if (current === request.current) setData(response.data);
    } catch (e) {
      if (current === request.current) setError(e.message);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [path, key]);
  useEffect(() => {
    reload();
    return () => {
      request.current++;
    };
  }, [reload]);
  return { data, loading, error, reload };
}
