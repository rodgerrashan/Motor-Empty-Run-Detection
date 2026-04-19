import { config } from "../config.js";

const stateWindow = [];
let seen = 0;

function summarizeDistribution(window) {
  const counts = {};
  for (const row of window) {
    counts[row.predicted_state] = (counts[row.predicted_state] || 0) + 1;
  }
  const total = window.length || 1;
  const distribution = {};
  for (const [key, value] of Object.entries(counts)) {
    distribution[key] = Number((value / total).toFixed(4));
  }
  return distribution;
}

function stdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((acc, x) => acc + x, 0) / values.length;
  const variance = values.reduce((acc, x) => acc + (x - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function registerPrediction(snapshot) {
  seen += 1;
  stateWindow.push(snapshot);

  if (stateWindow.length > config.evaluation.windowSize) {
    stateWindow.shift();
  }

  const shouldEmit = seen % config.evaluation.emitEvery === 0 && stateWindow.length >= Math.min(20, config.evaluation.windowSize);
  if (!shouldEmit) return null;

  const confidenceSeries = stateWindow
    .map((x) => x.confidence)
    .filter((x) => typeof x === "number" && !Number.isNaN(x));

  const confidence_mean = confidenceSeries.length
    ? Number((confidenceSeries.reduce((a, b) => a + b, 0) / confidenceSeries.length).toFixed(4))
    : null;

  const confidence_std = confidenceSeries.length ? Number(stdDev(confidenceSeries).toFixed(4)) : null;
  const class_distribution = summarizeDistribution(stateWindow);

  return {
    metric_type: "proxy_drift",
    window_size: stateWindow.length,
    confidence_mean,
    confidence_std,
    class_distribution,
    created_at: new Date()
  };
}
