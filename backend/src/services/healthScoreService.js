/**
 * Health Score Service
 * Calculates comprehensive motor health (0-100) based on multiple factors
 */

import { getDb } from "../db/mongo.js";
import { logger } from "../logger.js";

/**
 * Calculate health score for a motor
 * Factors: state distribution, temperature stability, vibration trend, current stability
 */
export async function calculateHealthScore(motorId, windowMinutes = 60) {
  try {
    const db = getDb();
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);

    // Fetch recent telemetry
    const telemetry = await db
      .collection("telemetry")
      .find({
        motor_id: motorId,
        event_time: { $gte: cutoffTime }
      })
      .sort({ event_time: -1 })
      .limit(1000)
      .toArray();

    if (telemetry.length === 0) {
      return { score: 50, reason: "Insufficient data" };
    }

    let score = 100;

    // 1. State Distribution (40% weight)
    const stateScores = {
      NORMAL: 100,
      OFF: 80,
      EMPTY_RUN: 40,
      STALLED: 10
    };

    const stateCounts = {};
    for (const t of telemetry) {
      stateCounts[t.predicted_state] = (stateCounts[t.predicted_state] || 0) + 1;
    }

    let stateScore = 0;
    for (const [state, count] of Object.entries(stateCounts)) {
      const stateWeight = count / telemetry.length;
      stateScore += (stateScores[state] || 50) * stateWeight;
    }
    score -= (100 - stateScore) * 0.4;

    // 2. Temperature Stability (20% weight)
    const temperatures = telemetry.map((t) => t.raw.temperature_c).filter((t) => typeof t === "number");
    if (temperatures.length > 1) {
      const tempMean = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
      const tempStdDev = Math.sqrt(
        temperatures.reduce((acc, t) => acc + Math.pow(t - tempMean, 2), 0) / temperatures.length
      );
      const tempVariability = Math.min(tempStdDev / tempMean, 1); // Normalized
      const tempScore = Math.max(0, 100 - tempVariability * 100 * 2); // High variability = bad
      score -= (100 - tempScore) * 0.2;

      // Overheating penalty
      const overheating = temperatures.filter((t) => t > 80).length;
      if (overheating > 0) {
        score -= Math.min(20, overheating * 2);
      }
    }

    // 3. Vibration Trend (20% weight)
    const vibrations = telemetry.map((t) => t.raw.vibration_hz).filter((v) => typeof v === "number");
    if (vibrations.length > 1) {
      const vibMean = vibrations.reduce((a, b) => a + b, 0) / vibrations.length;
      const vibStdDev = Math.sqrt(
        vibrations.reduce((acc, v) => acc + Math.pow(v - vibMean, 2), 0) / vibrations.length
      );
      const vibVariability = vibStdDev / Math.max(vibMean, 1);
      const vibScore = Math.max(0, 100 - vibVariability * 100 * 1.5);
      score -= (100 - vibScore) * 0.2;

      // High vibration penalty
      const highVibrations = vibrations.filter((v) => v > 100).length;
      if (highVibrations > 0) {
        score -= Math.min(15, highVibrations);
      }
    }

    // 4. Confidence in Predictions (20% weight)
    const confidences = telemetry.map((t) => t.confidence).filter((c) => typeof c === "number");
    if (confidences.length > 0) {
      const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const confScore = avgConfidence * 100;
      score -= (100 - confScore) * 0.2;
    }

    // Ensure score is in valid range
    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      score,
      window_minutes: windowMinutes,
      sample_count: telemetry.length,
      state_distribution: stateCounts,
      details: {
        state_score: stateScore,
        temp_variability: temperatures.length > 1 ? tempVariability : null,
        vib_variability: vibrations.length > 1 ? vibVariability : null,
        avg_confidence: confidences.length > 0 ? Number((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(4)) : null
      }
    };
  } catch (error) {
    logger.error("Health score calculation failed", { motorId, error: error.message });
    return { score: 50, reason: "Error calculating score", error: error.message };
  }
}

/**
 * Get health history for a motor (last N hours)
 */
export async function getHealthHistory(motorId, hourCount = 24, intervalMinutes = 30) {
  try {
    const db = getDb();
    const history = [];
    const now = Date.now();

    for (let i = 0; i < hourCount; i++) {
      const windowEnd = now - i * intervalMinutes * 60 * 1000;
      const windowStart = windowEnd - intervalMinutes * 60 * 1000;

      const telemetry = await db
        .collection("telemetry")
        .find({
          motor_id: motorId,
          event_time: { $gte: new Date(windowStart), $lt: new Date(windowEnd) }
        })
        .toArray();

      if (telemetry.length > 0) {
        const snapshot = await calculateHealthScore(motorId, intervalMinutes);
        history.push({
          timestamp: new Date(windowEnd),
          ...snapshot
        });
      }
    }

    return history.reverse();
  } catch (error) {
    logger.error("Health history fetch failed", { motorId, error: error.message });
    return [];
  }
}

/**
 * Determine health status level
 */
export function getHealthStatus(score) {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 50) return "WARNING";
  if (score >= 30) return "CRITICAL";
  return "FAILED";
}
