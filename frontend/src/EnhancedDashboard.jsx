import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";

const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8080";
const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

// ============== FORMATTING UTILITIES ==============

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

// ============== COMPONENT: HEALTH SCORE CARD ==============

function HealthScoreCard({ motorId }) {
  const [score, setScore] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScore = async () => {
      try {
        const resp = await fetch(`${apiBase}/api/health/score/${motorId}`);
        const data = await resp.json();
        setScore(data);

        const statusMap = {
          85: "EXCELLENT",
          70: "GOOD",
          50: "WARNING",
          30: "CRITICAL"
        };
        let status = "FAILED";
        for (const threshold of [85, 70, 50, 30]) {
          if (data.score >= threshold) {
            status = statusMap[threshold];
            break;
          }
        }
        setStatus(status);
      } catch (error) {
        console.error("Health score fetch error", error);
      } finally {
        setLoading(false);
      }
    };

    fetchScore();
    const interval = setInterval(fetchScore, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [motorId]);

  if (loading) return <div style={styles.card}>Loading health score...</div>;
  if (!score) return <div style={styles.card}>No health data</div>;

  const scoreColor =
    score.score >= 85 ? "#10b981" : score.score >= 70 ? "#3b82f6" : score.score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Motor Health Score</h3>
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{ fontSize: "48px", fontWeight: "bold", color: scoreColor }}>{score.score}</div>
        <div>
          <div style={styles.label}>Status</div>
          <div style={{ fontSize: "18px", color: scoreColor }}>{status}</div>
          <div style={styles.label}>Sample Count</div>
          <div>{score.sample_count} records</div>
        </div>
      </div>
    </div>
  );
}

// ============== COMPONENT: ENERGY METRICS CARD ==============

function EnergyMetricsCard({ motorId }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const resp = await fetch(`${apiBase}/api/energy/metrics/${motorId}?window=60`);
        const data = await resp.json();
        setMetrics(data);
      } catch (error) {
        console.error("Energy metrics fetch error", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [motorId]);

  if (loading) return <div style={styles.card}>Loading energy metrics...</div>;
  if (!metrics || metrics.error) return <div style={styles.card}>No energy data</div>;

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Energy Consumption</h3>
      <div style={styles.metricsGrid}>
        <div>
          <div style={styles.label}>Total Energy (1h)</div>
          <div style={styles.metricValue}>{fmtNum(metrics.energy.total_kwh)} kWh</div>
        </div>
        <div>
          <div style={styles.label}>Avg Power</div>
          <div style={styles.metricValue}>{fmtNum(metrics.energy.avg_power_kw)} kW</div>
        </div>
        <div>
          <div style={styles.label}>Est. Cost</div>
          <div style={styles.metricValue}>${fmtNum(metrics.cost.estimated_usd)}</div>
        </div>
        <div>
          <div style={styles.label}>Carbon (kg)</div>
          <div style={styles.metricValue}>{fmtNum(metrics.emissions.carbon_kg)}</div>
        </div>
      </div>
      <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
        Efficiency: {fmtNum(metrics.efficiency.score)}/100 ({metrics.efficiency.rating})
      </div>
    </div>
  );
}

// ============== COMPONENT: ANOMALY ALERT ==============

function AnomalyDetectionCard({ motorId }) {
  const [anomalies, setAnomalies] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnomalies = async () => {
      try {
        const resp = await fetch(`${apiBase}/api/anomalies/detect/${motorId}?window=120`);
        const data = await resp.json();
        setAnomalies(data);
      } catch (error) {
        console.error("Anomaly detection fetch error", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnomalies();
    const interval = setInterval(fetchAnomalies, 60000);
    return () => clearInterval(interval);
  }, [motorId]);

  if (loading) return <div style={styles.card}>Loading anomalies...</div>;
  if (!anomalies) return <div style={styles.card}>No anomaly data</div>;

  const criticalCount = anomalies.anomalies?.filter((a) => a.severity === "HIGH").length || 0;
  const warningCount = anomalies.anomalies?.filter((a) => a.severity === "MEDIUM").length || 0;

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Anomaly Detection</h3>
      <div style={styles.metricsGrid}>
        <div>
          <div style={styles.label}>Total Anomalies</div>
          <div style={styles.metricValue}>{anomalies.anomaly_count}</div>
        </div>
        <div>
          <div style={styles.label}>Critical</div>
          <div style={{ ...styles.metricValue, color: "#ef4444" }}>{criticalCount}</div>
        </div>
        <div>
          <div style={styles.label}>Warning</div>
          <div style={{ ...styles.metricValue, color: "#f59e0b" }}>{warningCount}</div>
        </div>
      </div>
      {anomalies.anomalies && anomalies.anomalies.length > 0 && (
        <div style={{ marginTop: "10px", fontSize: "12px" }}>
          <strong>Latest:</strong> {anomalies.anomalies[0].feature} ({fmtNum(anomalies.anomalies[0].z_score)}σ)
        </div>
      )}
    </div>
  );
}

// ============== COMPONENT: MAINTENANCE CARD ==============

function MaintenanceCard({ motorId }) {
  const [maintenance, setMaintenance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMaintenance = async () => {
      try {
        const resp = await fetch(`${apiBase}/api/maintenance/recommendations/${motorId}`);
        const data = await resp.json();
        setMaintenance(data);
      } catch (error) {
        console.error("Maintenance fetch error", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMaintenance();
    const interval = setInterval(fetchMaintenance, 60000);
    return () => clearInterval(interval);
  }, [motorId]);

  if (loading) return <div style={styles.card}>Loading maintenance...</div>;
  if (!maintenance || maintenance.error) return <div style={styles.card}>No maintenance data</div>;

  const riskColor =
    maintenance.risk_level === "CRITICAL"
      ? "#ef4444"
      : maintenance.risk_level === "HIGH"
        ? "#f59e0b"
        : maintenance.risk_level === "MEDIUM"
          ? "#3b82f6"
          : "#10b981";

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Predictive Maintenance</h3>
      <div style={{ marginBottom: "10px" }}>
        <div style={styles.label}>Risk Level</div>
        <div style={{ fontSize: "20px", color: riskColor, fontWeight: "bold" }}>{maintenance.risk_level}</div>
      </div>
      {maintenance.recommendations && maintenance.recommendations.length > 0 && (
        <div style={{ fontSize: "12px" }}>
          <strong>Actions:</strong>
          <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
            {maintenance.recommendations.slice(0, 3).map((rec, i) => (
              <li key={i}>{rec.action}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============== MAIN DASHBOARD ==============

export default function EnhancedDashboard() {
  const [motorId, setMotorId] = useState("motor_1");
  const [trend, setTrend] = useState([]);
  const [ws, setWs] = useState(null);

  // WebSocket connection
  useEffect(() => {
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connected");
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "telemetry" && message.data.motor_id === motorId) {
        setTrend((prev) => [...prev.slice(-99), message.data]);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
      setTimeout(() => {
        setWs(new WebSocket(wsUrl));
      }, 3000);
    };

    setWs(socket);
    return () => socket.close();
  }, [motorId]);

  // Trend chart
  const trendOption = useMemo(() => {
    const labels = trend.map((row) => formatTs(row.event_time));
    const rpm = trend.map((row) => toNum(row.raw?.rpm));
    const vibration = trend.map((row) => toNum(row.raw?.vibration_hz));
    const current = trend.map((row) => toNum(row.raw?.current_amp));
    const temp = trend.map((row) => toNum(row.raw?.temperature_c));

    return {
      legend: { data: ["RPM", "Vibration (Hz)", "Current (A)", "Temp (°C)"] },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: labels },
      yAxis: [{ type: "value" }, { type: "value", position: "right" }],
      series: [
        { name: "RPM", type: "line", data: rpm, smooth: true },
        { name: "Vibration (Hz)", type: "line", data: vibration, smooth: true, yAxisIndex: 1 },
        { name: "Current (A)", type: "line", data: current, smooth: true },
        { name: "Temp (°C)", type: "line", data: temp, smooth: true, yAxisIndex: 1 }
      ]
    };
  }, [trend]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🚀 Enhanced Motor Monitoring Dashboard</h1>
        <div>
          <label style={{ marginRight: "10px" }}>Motor ID:</label>
          <input
            type="text"
            value={motorId}
            onChange={(e) => setMotorId(e.target.value)}
            style={{ padding: "5px 10px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
      </div>

      <div style={styles.grid2}>
        <HealthScoreCard motorId={motorId} />
        <EnergyMetricsCard motorId={motorId} />
      </div>

      <div style={styles.grid2}>
        <AnomalyDetectionCard motorId={motorId} />
        <MaintenanceCard motorId={motorId} />
      </div>

      <div style={{ ...styles.card, marginTop: "20px" }}>
        <h3 style={styles.cardTitle}>Sensor Trends (Live)</h3>
        <ReactECharts option={trendOption} style={{ height: "300px" }} />
      </div>
    </div>
  );
}

// ============== STYLES ==============

const styles = {
  container: {
    padding: "20px",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    minHeight: "100vh",
    fontFamily: "system-ui, -apple-system, sans-serif"
  },
  header: {
    marginBottom: "30px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginBottom: "20px"
  },
  card: {
    backgroundColor: "#1e293b",
    padding: "20px",
    borderRadius: "8px",
    border: "1px solid #334155",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
  },
  cardTitle: {
    margin: "0 0 15px 0",
    fontSize: "16px",
    fontWeight: "600",
    color: "#f1f5f9"
  },
  label: {
    fontSize: "12px",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: "5px"
  },
  metricValue: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#0ea5e9"
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "15px"
  }
};
