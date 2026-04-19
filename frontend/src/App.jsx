import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";

const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8080";
const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

const formatTs = (ts) => {
  if (!ts) return "-";
  return new Date(ts).toLocaleTimeString();
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmtNum = (v, digits = 2) => {
  const n = toNum(v);
  return n == null ? "n/a" : n.toFixed(digits);
};

const alertCodeLabel = (code) => {
  const n = toNum(code);
  if (n == null || n <= 0) return "-";
  return `A-${String(Math.trunc(n)).padStart(2, "0")}`;
};

const gaugeOption = ({ name, value, min, max, warnAt, dangerAt, unit }) => {
  const safeValue = toNum(value) ?? min;
  const span = max - min;
  const warnRatio = span > 0 ? Math.max(0, Math.min(1, (warnAt - min) / span)) : 0.6;
  const dangerRatio = span > 0 ? Math.max(0, Math.min(1, (dangerAt - min) / span)) : 0.85;
  return {
    animationDuration: 500,
    series: [
      {
        type: "gauge",
        min,
        max,
        progress: {
          show: true,
          width: 12
        },
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [warnRatio, "#00d4ff"],
              [dangerRatio, "#facc15"],
              [1, "#f43f5e"]
            ]
          }
        },
        axisTick: { distance: -16, splitNumber: 5, lineStyle: { color: "#7dd3fc", width: 1 } },
        splitLine: { distance: -18, length: 8, lineStyle: { color: "#cbd5e1", width: 1 } },
        axisLabel: { distance: -30, color: "#94a3b8", fontSize: 9 },
        pointer: { length: "68%", width: 4, itemStyle: { color: "#e2e8f0" } },
        anchor: { show: true, size: 7, itemStyle: { color: "#38bdf8" } },
        detail: {
          valueAnimation: true,
          formatter: `{value} ${unit}`,
          color: "#f8fafc",
          fontSize: 14,
          offsetCenter: [0, "78%"]
        },
        title: {
          offsetCenter: [0, "102%"],
          color: "#94a3b8",
          fontSize: 11
        },
        data: [{ value: safeValue, name }]
      }
    ]
  };
};

const trendOption = (trend) => {
  const labels = trend.map((row) => formatTs(row.event_time));
  const rpm = trend.map((row) => toNum(row.raw?.rpm));
  const vibration = trend.map((row) => toNum(row.raw?.vibration_hz));
  const current = trend.map((row) => toNum(row.raw?.current_amp));
  const temperature = trend.map((row) => toNum(row.raw?.temperature_c));

  return {
    color: ["#38bdf8", "#f59e0b", "#10b981", "#f87171"],
    animationDuration: 500,
    tooltip: { trigger: "axis" },
    legend: {
      top: 4,
      textStyle: { color: "#cbd5e1", fontSize: 11 }
    },
    grid: { top: 42, right: 18, left: 42, bottom: 28 },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 }
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#1e293b" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 }
    },
    series: [
      { name: "RPM", type: "line", smooth: true, symbol: "none", data: rpm },
      { name: "Vibration", type: "line", smooth: true, symbol: "none", data: vibration },
      { name: "Current", type: "line", smooth: true, symbol: "none", data: current },
      { name: "Temp", type: "line", smooth: true, symbol: "none", data: temperature }
    ]
  };
};

const confidenceTrendOption = (trend) => {
  const labels = trend.map((row) => formatTs(row.event_time));
  const values = trend.map((row) => {
    const confidence = toNum(row.confidence);
    return confidence == null ? null : Math.max(0, Math.min(1, confidence));
  });

  return {
    color: ["#22d3ee"],
    tooltip: { trigger: "axis" },
    grid: { top: 28, right: 16, left: 40, bottom: 26 },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 }
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 1,
      splitLine: { lineStyle: { color: "#1e293b" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 }
    },
    series: [
      {
        name: "Confidence",
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        areaStyle: { opacity: 0.18 },
        data: values
      }
    ]
  };
};

const classDistributionOption = (snapshot) => {
  const source = snapshot?.class_distribution;
  const entries = Object.entries(source || {}).filter(([, v]) => toNum(v) != null);
  const data = entries.length
    ? entries.map(([k, v]) => ({ name: k, value: Number(v) }))
    : [{ name: "No Data", value: 1 }];

  return {
    color: ["#34d399", "#fbbf24", "#f87171", "#94a3b8", "#22d3ee"],
    tooltip: { trigger: "item" },
    legend: {
      bottom: 0,
      textStyle: { color: "#cbd5e1", fontSize: 11 }
    },
    series: [
      {
        type: "pie",
        radius: ["46%", "72%"],
        center: ["50%", "42%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: "#0b1220",
          borderWidth: 2
        },
        label: {
          color: "#cbd5e1",
          formatter: "{b}: {d}%"
        },
        data
      }
    ]
  };
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
  const [bootError, setBootError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [wsState, setWsState] = useState("connecting");

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      setBootError("");
      try {
        const [tRes, aRes, eRes] = await Promise.all([
          fetch(`${apiBase}/api/telemetry/latest?limit=60`),
          fetch(`${apiBase}/api/alerts/recent?limit=60`),
          fetch(`${apiBase}/api/eval/latest`)
        ]);

        const [t, a, e] = await Promise.all([tRes.json(), aRes.json(), eRes.json()]);
        setLatest(Array.isArray(t) ? t : []);
        setAlerts(Array.isArray(a) ? a : []);
        setEvalSnapshot(e && Object.keys(e).length ? e : null);
      } catch {
        setBootError("Bootstrap fetch failed. Showing live data when available.");
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => setWsState("connected");
    ws.onerror = () => setWsState("error");
    ws.onclose = () => setWsState("closed");
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "telemetry") {
          setLatest((prev) => [msg.payload, ...prev].slice(0, 80));
        }
        if (msg.type === "alert") {
          setAlerts((prev) => [msg.payload, ...prev].slice(0, 80));
        }
        if (msg.type === "model_eval") {
          setEvalSnapshot(msg.payload);
        }
      } catch {
        setWsState("error");
      }
    };

    return () => ws.close();
  }, []);

  const current = latest[0];
  const trend = useMemo(() => latest.slice(0, 24).reverse(), [latest]);
  const confidenceRows = useMemo(() => latest.slice(0, 30).reverse(), [latest]);
  const visibleAlerts = useMemo(() => alerts.slice(0, 50), [alerts]);

  const healthStatus = useMemo(() => {
    if (!evalSnapshot) return { label: "NO_EVAL", className: "health-warn" };
    const std = toNum(evalSnapshot.confidence_std);
    const age = Date.now() - new Date(evalSnapshot.created_at || Date.now()).getTime();
    if (age > 10 * 60 * 1000) return { label: "STALE", className: "health-warn" };
    if (std != null && std > 0.22) return { label: "DRIFT_RISK", className: "health-bad" };
    return { label: "HEALTHY", className: "health-ok" };
  }, [evalSnapshot]);

  const kpis = useMemo(() => {
    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter((a) => ["STALLED", "OFF"].includes(String(a.predicted_state || "").toUpperCase())).length;
    const lastEvent = current?.event_time || null;
    return {
      totalAlerts,
      criticalAlerts,
      wsState,
      lastEvent
    };
  }, [alerts, current, wsState]);

  return (
    <main className="page noc-shell">
      <header className="hero noc-hero">
        <div>
          <p className="eyebrow">OPERATIONS CENTER</p>
          <h1>Motor Runtime Command Board</h1>
          <p>Real-time telemetry, ONNX inference, and drift visibility in one control surface.</p>
        </div>
        <div className="hero-status">
          <span className={`pill pill-${kpis.wsState}`}>WS: {String(kpis.wsState).toUpperCase()}</span>
          <span className="pill">Last Event: {formatTs(kpis.lastEvent)}</span>
          <span className={`pill ${healthStatus.className}`}>Model: {healthStatus.label}</span>
        </div>
      </header>

      {bootError ? <p className="banner banner-error">{bootError}</p> : null}
      {isLoading ? <p className="banner">Loading initial snapshots...</p> : null}

      <section className="grid kpi-grid">
        <article className="card kpi-card">
          <h2>Current State</h2>
          {current ? (
            <>
              <StateBadge state={current.predicted_state} />
              <p>Motor: {current.motor_id || "-"}</p>
              <p>Confidence: {fmtNum(current.confidence, 4)}</p>
              <p>Last update: {formatTs(current.event_time)}</p>
            </>
          ) : (
            <p>No data yet</p>
          )}
        </article>

        <article className="card kpi-card">
          <h2>Alert Stats</h2>
          <p>Total Recent Alerts: {kpis.totalAlerts}</p>
          <p>Critical (Stalled/Off): {kpis.criticalAlerts}</p>
          <p>WS Status: {String(kpis.wsState).toUpperCase()}</p>
        </article>

        <article className="card kpi-card">
          <h2>Model Evaluation</h2>
          {evalSnapshot ? (
            <>
              <p>Window: {evalSnapshot.window_size ?? "n/a"}</p>
              <p>Confidence mean: {fmtNum(evalSnapshot.confidence_mean, 4)}</p>
              <p>Confidence std: {fmtNum(evalSnapshot.confidence_std, 4)}</p>
              <p>Updated: {formatTs(evalSnapshot.created_at)}</p>
            </>
          ) : (
            <p>No metrics yet</p>
          )}
        </article>

        <article className="card kpi-card">
          <h2>Signal Quality</h2>
          <p>Alert Code: {alertCodeLabel(current?.alert_code)}</p>
          <p>Source Status: {current?.source_status || "-"}</p>
          <p>Source State: {current?.source_state || "-"}</p>
        </article>
      </section>

      <section className="gauge-grid">
        <article className="card gauge-card">
          <h2>RPM Meter</h2>
          <ReactECharts
            option={gaugeOption({
              name: "RPM",
              value: current?.raw?.rpm,
              min: 0,
              max: 3500,
              warnAt: 2400,
              dangerAt: 3000,
              unit: "rpm"
            })}
            className="gauge"
          />
        </article>

        <article className="card gauge-card">
          <h2>Vibration Meter</h2>
          <ReactECharts
            option={gaugeOption({
              name: "Vibration",
              value: current?.raw?.vibration_hz,
              min: 0,
              max: 120,
              warnAt: 65,
              dangerAt: 90,
              unit: "Hz"
            })}
            className="gauge"
          />
        </article>

        <article className="card gauge-card">
          <h2>Current Meter</h2>
          <ReactECharts
            option={gaugeOption({
              name: "Current",
              value: current?.raw?.current_amp,
              min: 0,
              max: 60,
              warnAt: 34,
              dangerAt: 46,
              unit: "A"
            })}
            className="gauge"
          />
        </article>

        <article className="card gauge-card">
          <h2>Temperature Meter</h2>
          <ReactECharts
            option={gaugeOption({
              name: "Temp",
              value: current?.raw?.temperature_c,
              min: 0,
              max: 140,
              warnAt: 85,
              dangerAt: 105,
              unit: "C"
            })}
            className="gauge"
          />
        </article>

        <article className="card gauge-card">
          <h2>Power Factor</h2>
          <ReactECharts
            option={gaugeOption({
              name: "PF",
              value: current?.raw?.power_factor,
              min: 0,
              max: 1,
              warnAt: 0.7,
              dangerAt: 0.5,
              unit: ""
            })}
            className="gauge"
          />
        </article>
      </section>

      <section className="ops-grid">
        <article className="card trends-card">
          <div className="card-head">
            <h2>Telemetry Trend Matrix</h2>
            <span>Last {trend.length} events</span>
          </div>
          <ReactECharts option={trendOption(trend)} className="chart-lg" />
        </article>

        <article className="card ai-card">
          <div className="card-head">
            <h2>AI Evaluation Board</h2>
            <span>{evalSnapshot ? `Window ${evalSnapshot.window_size ?? "n/a"}` : "No snapshot"}</span>
          </div>

          <div className="ai-metrics">
            <p>Mean Confidence: {fmtNum(evalSnapshot?.confidence_mean, 4)}</p>
            <p>Std Confidence: {fmtNum(evalSnapshot?.confidence_std, 4)}</p>
            <p>Last Eval: {formatTs(evalSnapshot?.created_at)}</p>
            <p className={healthStatus.className}>Model Health: {healthStatus.label}</p>
          </div>

          <ReactECharts option={confidenceTrendOption(confidenceRows)} className="chart-sm" />
          <ReactECharts option={classDistributionOption(evalSnapshot)} className="chart-sm" />
        </article>
      </section>

      <section className="alerts-section">
        <article className="card alerts-card">
          <div className="card-head">
            <h2>Alerts Console</h2>
            <span>10 visible, scroll for older</span>
          </div>
          <ul className="alert-list alerts-viewport">
            {visibleAlerts.length === 0 ? <li className="alert-row">No alerts</li> : null}
            {visibleAlerts.map((a, idx) => (
              <li key={`${a.created_at || "na"}-${idx}`} className="alert-row">
                <StateBadge state={a.predicted_state} />
                <span>{a.motor_id || "-"}</span>
                <span>{alertCodeLabel(a.alert_code)}</span>
                <span>{formatTs(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
