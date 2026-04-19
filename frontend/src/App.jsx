import React, { useEffect, useMemo, useState } from "react";

const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8080";
const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

const formatTs = (ts) => {
  if (!ts) return "-";
  return new Date(ts).toLocaleTimeString();
};

function StateBadge({ state }) {
  const key = String(state || "UNKNOWN").toUpperCase();
  const map = {
    NORMAL: "badge-ok",
    EMPTY_RUN: "badge-warn",
    STALLED: "badge-bad",
    OFF: "badge-off"
  };

  return <span className={`badge ${map[key] || "badge-off"}`}>{key}</span>;
}

export default function App() {
  const [latest, setLatest] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [evalSnapshot, setEvalSnapshot] = useState(null);

  useEffect(() => {
    const bootstrap = async () => {
      const [t, a, e] = await Promise.all([
        fetch(`${apiBase}/api/telemetry/latest?limit=30`).then((r) => r.json()),
        fetch(`${apiBase}/api/alerts/recent?limit=20`).then((r) => r.json()),
        fetch(`${apiBase}/api/eval/latest`).then((r) => r.json())
      ]);
      setLatest(Array.isArray(t) ? t : []);
      setAlerts(Array.isArray(a) ? a : []);
      setEvalSnapshot(e && Object.keys(e).length ? e : null);
    };

    bootstrap().catch(() => undefined);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "telemetry") {
        setLatest((prev) => [msg.payload, ...prev].slice(0, 50));
      }
      if (msg.type === "alert") {
        setAlerts((prev) => [msg.payload, ...prev].slice(0, 50));
      }
      if (msg.type === "model_eval") {
        setEvalSnapshot(msg.payload);
      }
    };

    return () => ws.close();
  }, []);

  const current = latest[0];
  const trend = useMemo(() => latest.slice(0, 12).reverse(), [latest]);

  return (
    <main className="page">
      <header className="hero">
        <h1>Motor Live Dashboard</h1>
        <p>MQTT ingestion, ONNX inference, and MongoDB-backed live monitoring.</p>
      </header>

      <section className="grid cards">
        <article className="card">
          <h2>Current State</h2>
          {current ? (
            <>
              <StateBadge state={current.predicted_state} />
              <p>Motor: {current.motor_id}</p>
              <p>Confidence: {current.confidence != null ? current.confidence.toFixed(4) : "n/a"}</p>
              <p>Last update: {formatTs(current.event_time)}</p>
            </>
          ) : (
            <p>No data yet</p>
          )}
        </article>

        <article className="card">
          <h2>Latest Telemetry</h2>
          {current ? (
            <ul>
              <li>RPM: {current.raw?.rpm}</li>
              <li>Vibration: {current.raw?.vibration_hz}</li>
              <li>Current: {current.raw?.current_amp}</li>
              <li>Temperature: {current.raw?.temperature_c}</li>
              <li>Power Factor: {current.raw?.power_factor}</li>
            </ul>
          ) : (
            <p>Waiting for stream</p>
          )}
        </article>

        <article className="card">
          <h2>Model Eval (Proxy)</h2>
          {evalSnapshot ? (
            <>
              <p>Window: {evalSnapshot.window_size}</p>
              <p>Confidence mean: {evalSnapshot.confidence_mean ?? "n/a"}</p>
              <p>Confidence std: {evalSnapshot.confidence_std ?? "n/a"}</p>
              <p>Updated: {formatTs(evalSnapshot.created_at)}</p>
            </>
          ) : (
            <p>No metrics yet</p>
          )}
        </article>
      </section>

      <section className="grid two-col">
        <article className="card">
          <h2>Recent Trend</h2>
          <div className="mini-chart">
            {trend.map((row, idx) => {
              const h = Math.max(4, Math.min(100, Number(row.raw?.current_amp || 0) * 3));
              return <div key={idx} className="bar" title={`A:${row.raw?.current_amp}`} style={{ height: `${h}%` }} />;
            })}
          </div>
          <p className="hint">Bars represent current_amp for the last events.</p>
        </article>

        <article className="card">
          <h2>Alert Feed</h2>
          <ul className="alert-list">
            {alerts.length === 0 ? <li>No alerts</li> : null}
            {alerts.map((a, idx) => (
              <li key={idx}>
                <StateBadge state={a.predicted_state} />
                <span>{a.motor_id}</span>
                <span>{formatTs(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
