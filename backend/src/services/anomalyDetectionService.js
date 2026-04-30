/**
 * Anomaly Detection Service
 * Statistical anomaly detection independent of ML model predictions
 * Uses Z-score and IQR methods
 */

import { getDb } from "../db/mongo.js";
import { logger } from "../logger.js";

/**
 * Calculate Z-score for anomaly detection
 */
function calculateZScore(value, mean, stdDev) {
  if (stdDev === 0) return 0;
  return Math.abs((value - mean) / stdDev);
}

/**
 * Calculate IQR-based bounds
 */
function calculateIQRBounds(values, multiplier = 1.5) {
  if (values.length < 4) return { lower: null, upper: null };

  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);

  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  return {
    lower: q1 - multiplier * iqr,
    upper: q3 + multiplier * iqr,
    q1,
    q3,
    iqr
  };
}

/**
 * Detect anomalies in telemetry data
 */
export async function detectAnomalies(motorId, windowMinutes = 120) {
  try {
    const db = getDb();
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);

    const telemetry = await db
      .collection("telemetry")
      .find({
        motor_id: motorId,
        event_time: { $gte: cutoffTime }
      })
      .sort({ event_time: 1 })
      .toArray();

    if (telemetry.length < 5) {
      return { anomalies: [], reason: "Insufficient data" };
    }

    const anomalies = [];

    // Extract feature series
    const rawSeries = {
      rpm: telemetry.map((t) => t.raw.rpm).filter((v) => typeof v === "number"),
      vibration_hz: telemetry.map((t) => t.raw.vibration_hz).filter((v) => typeof v === "number"),
      current_amp: telemetry.map((t) => t.raw.current_amp).filter((v) => typeof v === "number"),
      temperature_c: telemetry.map((t) => t.raw.temperature_c).filter((v) => typeof v === "number"),
      power_factor: telemetry.map((t) => t.raw.power_factor).filter((v) => typeof v === "number")
    };

    // Analyze each feature
    for (const [feature, values] of Object.entries(rawSeries)) {
      if (values.length < 5) continue;

      // Calculate statistics
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // IQR bounds
      const iqrBounds = calculateIQRBounds(values, 1.5);

      // Find anomalies using Z-score
      for (let i = 0; i < telemetry.length; i++) {
        const value = telemetry[i].raw[feature];
        if (typeof value !== "number") continue;

        // Z-score method
        const zScore = calculateZScore(value, mean, stdDev);
        const isZAnomaly = zScore > 3; // 3-sigma rule

        // IQR method
        const isIQRAnomaly =
          iqrBounds.lower !== null && (value < iqrBounds.lower || value > iqrBounds.upper);

        if (isZAnomaly || isIQRAnomaly) {
          anomalies.push({
            timestamp: telemetry[i].event_time,
            feature,
            value,
            mean: Number(mean.toFixed(2)),
            stdDev: Number(stdDev.toFixed(2)),
            z_score: Number(zScore.toFixed(2)),
            deviation_percent: Number(((Math.abs(value - mean) / mean) * 100).toFixed(1)),
            method: isZAnomaly && isIQRAnomaly ? "Z-SCORE+IQR" : isZAnomaly ? "Z-SCORE" : "IQR",
            severity: zScore > 5 ? "HIGH" : zScore > 3 ? "MEDIUM" : "LOW"
          });
        }
      }
    }

    // Sort by timestamp descending
    anomalies.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      motor_id: motorId,
      anomaly_count: anomalies.length,
      window_minutes: windowMinutes,
      sample_count: telemetry.length,
      anomalies: anomalies.slice(0, 100), // Return top 100
      last_check: new Date()
    };
  } catch (error) {
    logger.error("Anomaly detection failed", { motorId, error: error.message });
    return { anomalies: [], error: error.message };
  }
}

/**
 * Detect sudden changes in sensor readings
 */
export async function detectSuddenChanges(motorId, windowMinutes = 60, changeThresholdPercent = 20) {
  try {
    const db = getDb();
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);

    const telemetry = await db
      .collection("telemetry")
      .find({
        motor_id: motorId,
        event_time: { $gte: cutoffTime }
      })
      .sort({ event_time: 1 })
      .toArray();

    if (telemetry.length < 2) {
      return { changes: [] };
    }

    const changes = [];
    const features = ["rpm", "vibration_hz", "current_amp", "temperature_c", "power_factor"];

    for (let i = 1; i < telemetry.length; i++) {
      const prev = telemetry[i - 1].raw;
      const curr = telemetry[i].raw;

      for (const feature of features) {
        if (typeof prev[feature] !== "number" || typeof curr[feature] !== "number") continue;

        const changePercent = Math.abs((curr[feature] - prev[feature]) / Math.max(prev[feature], 0.001)) * 100;

        if (changePercent > changeThresholdPercent) {
          changes.push({
            timestamp: telemetry[i].event_time,
            feature,
            previous_value: prev[feature],
            current_value: curr[feature],
            change_percent: Number(changePercent.toFixed(1)),
            direction: curr[feature] > prev[feature] ? "UP" : "DOWN"
          });
        }
      }
    }

    return {
      motor_id: motorId,
      change_count: changes.length,
      threshold_percent: changeThresholdPercent,
      window_minutes: windowMinutes,
      changes: changes.slice(-50) // Return last 50
    };
  } catch (error) {
    logger.error("Change detection failed", { motorId, error: error.message });
    return { changes: [], error: error.message };
  }
}

/**
 * Get anomaly trends (anomaly frequency over time)
 */
export async function getAnomalyTrends(motorId, intervalHours = 1, lookbackHours = 24) {
  try {
    const db = getDb();
    const trends = [];

    for (let i = 0; i < lookbackHours; i++) {
      const windowEnd = Date.now() - i * intervalHours * 60 * 60 * 1000;
      const windowStart = windowEnd - intervalHours * 60 * 60 * 1000;

      const anomalyResult = await detectAnomalies(motorId, (lookbackHours - i) * 60);
      const count = anomalyResult.anomalies ? anomalyResult.anomalies.length : 0;

      if (count > 0) {
        trends.push({
          hour: i,
          timestamp: new Date(windowEnd),
          anomaly_count: count,
          severity_distribution: categorizeAnomalySeverity(anomalyResult.anomalies)
        });
      }
    }

    return trends;
  } catch (error) {
    logger.error("Anomaly trends fetch failed", { motorId, error: error.message });
    return [];
  }
}

/**
 * Categorize anomalies by severity
 */
function categorizeAnomalySeverity(anomalies) {
  const distribution = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const anomaly of anomalies) {
    distribution[anomaly.severity]++;
  }
  return distribution;
}
