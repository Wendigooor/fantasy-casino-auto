import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function HealthPage() {
  const [status, setStatus] = useState<string>("checking...");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setStatus(data.status === "ok" ? "healthy" : "unhealthy");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  return (
    <div className="page">
      <h2>Health Check</h2>
      <div className={`status status-${status}`}>
        <span className="status-dot" />
        <span>Status: {status}</span>
      </div>
      {error && <p className="error">Error: {error}</p>}
      {data && (
        <pre className="json-output">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
