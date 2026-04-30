/**
 * Predictive Maintenance Service
 * Predicts equipment failure and maintenance needs based on trends
 */

import { getDb } from "../db/mongo.js";
import { logger } from "../logger.js";

/**
 * Simple exponential smoothing for trend prediction
 */
function exponentialSmoothing(series, alpha = 0.3, forecastPeriods = 5) {
  if (series.length === 0) return { forecast: [], trend: null };

  let smoothed = series[0];
  const smoothedSeries = [smoothed];

  // Smooth the series
  for (let i = 1; i < series.length; i++) {
    smoothed = alpha * series[i] + (1 - alpha) * smoothed;
    smoothedSeries.push(smoothed);
  }

  // Calculate trend (slope)
  let trend = 0;
  if (smoothedSeries.length > 1) {
    trend = (smoothedSeries[smoothedSeries.length - 1] - smoothedSeries[0]) / (smoothedSeries.length - 1);
  }

  // Forecast
  const forecast = [];
  let lastValue = smoothedSeries[smoothedSeries.length - 1];
  for (let i = 0; i < forecastPeriods; i++) {
    lastValue += trend;
    forecast.push(Number(lastValue.toFixed(2)));
  }

  return {
    forecast,
    trend: Number(trend.toFixed(4)),
    lastSmoothedValue: Number(lastValue.toFixed(2))
  };
}

/**
 * Detect degradation trends
 */
export async function detectDegradationTrends(motorId, windowHours = 168) {
  try {
    const db = getDb();
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const telemetry = await db
      .collection("telemetry")
      .find({
        motor_id: motorId,
        event_time: { $gte: cutoffTime }
      })
      .sort({ event_time: 1 })
      .toArray();

    if (telemetry.length < 10) {
      return { warning: "Insufficient data for trend analysis" };
    }

    // Aggregate by hour
    const hourlyAgg = {};
    for (const t of telemetry) {
      const hour = Math.floor(new Date(t.event_time).getTime() / (3600 * 1000));
      if (!hourlyAgg[hour]) {
        hourlyAgg[hour] = {
          temperature: [],
          vibration: [],
          current: [],
          abnormal_states: 0
        };
      }
      hourlyAgg[hour].temperature.push(t.raw.temperature_c);
      hourlyAgg[hour].vibration.push(t.raw.vibration_hz);
      hourlyAgg[hour].current.push(t.raw.current_amp);
      if (t.predicted_state !== "NORMAL" && t.predicted_state !== "OFF") {
        hourlyAgg[hour].abnormal_states++;
      }
    }

    // Calculate hourly averages and trends
    const timePoints = Object.keys(hourlyAgg)
      .sort((a, b) => Number(a) - Number(b))
      .map(Number);
    const temperatures = timePoints.map(
      (h) => hourlyAgg[h].temperature.reduce((a, b) => a + b, 0) / hourlyAgg[h].temperature.length
    );
    const vibrations = timePoints.map(
      (h) => hourlyAgg[h].vibration.reduce((a, b) => a + b, 0) / hourlyAgg[h].vibration.length
    );
    const currents = timePoints.map(
      (h) => hourlyAgg[h].current.reduce((a, b) => a + b, 0) / hourlyAgg[h].current.length
    );
    const abnormalRates = timePoints.map((h) => hourlyAgg[h].abnormal_states);

    // Calculate trends
    const tempTrend = exponentialSmoothing(temperatures, 0.3, 24);
    const vibTrend = exponentialSmoothing(vibrations, 0.3, 24);
    const currentTrend = exponentialSmoothing(currents, 0.3, 24);

    // Determine degradation risk
    let riskScore = 0;
    let riskFactors = [];

    // Temperature trend
    if (tempTrend.trend > 0.5) {
      riskScore += 25;
      riskFactors.push(`Temperature increasing at ${tempTrend.trend.toFixed(2)}°C/hour`);
    }

    // Vibration trend
    if (vibTrend.trend > 0.5) {
      riskScore += 25;
      riskFactors.push(`Vibration increasing at ${vibTrend.trend.toFixed(2)} Hz/hour`);
    }

    // Current trend
    if (currentTrend.trend > 0.1) {
      riskScore += 20;
      riskFactors.push(`Current draw increasing at ${currentTrend.trend.toFixed(2)} A/hour`);
    }

    // Abnormal states frequency
    const abnormalFreq = abnormalRates.reduce((a, b) => a + b, 0) / abnormalRates.length;
    if (abnormalFreq > 2) {
      riskScore += 20;
      riskFactors.push(`High abnormal state frequency: ${abnormalFreq.toFixed(1)} occurrences/hour`);
    }

    // Predict when thresholds will be exceeded
    const predictedFailureTime = predictFailureTime(tempTrend, vibTrend, currentTrend);

    return {
      motor_id: motorId,
      analysis_window_hours: windowHours,
      risk_score: Math.min(100, riskScore),
      risk_level:
        riskScore >= 75
          ? "CRITICAL"
          : riskScore >= 50
            ? "HIGH"
            : riskScore >= 25
              ? "MEDIUM"
              : "LOW",
      risk_factors: riskFactors,
      trends: {
        temperature: {
          current: Number(temperatures[temperatures.length - 1].toFixed(1)),
          trend_per_hour: tempTrend.trend,
          forecast_24h: tempTrend.forecast.slice(0, 24)
        },
        vibration: {
          current: Number(vibrations[vibrations.length - 1].toFixed(1)),
          trend_per_hour: vibTrend.trend,
          forecast_24h: vibTrend.forecast.slice(0, 24)
        },
        current: {
          current: Number(currents[currents.length - 1].toFixed(2)),
          trend_per_hour: currentTrend.trend,
          forecast_24h: currentTrend.forecast.slice(0, 24)
        }
      },
      predicted_failure: predictedFailureTime,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error("Degradation trend detection failed", { motorId, error: error.message });
    return { error: error.message };
  }
}

/**
 * Predict when equipment will fail based on trends
 */
function predictFailureTime(tempTrend, vibTrend, currentTrend) {
  // Define thresholds
  const tempThreshold = 85;
  const vibThreshold = 120;
  const currentThreshold = 28;

  const predictions = [];

  // Temperature prediction
  if (tempTrend.trend > 0) {
    const hoursToThreshold = (tempThreshold - tempTrend.lastSmoothedValue) / tempTrend.trend;
    if (hoursToThreshold > 0) {
      predictions.push({
        factor: "temperature",
        threshold: tempThreshold,
        hours_remaining: Number(hoursToThreshold.toFixed(1)),
        failure_date: new Date(Date.now() + hoursToThreshold * 3600 * 1000)
      });
    }
  }

  // Vibration prediction
  if (vibTrend.trend > 0) {
    const hoursToThreshold = (vibThreshold - vibTrend.lastSmoothedValue) / vibTrend.trend;
    if (hoursToThreshold > 0) {
      predictions.push({
        factor: "vibration",
        threshold: vibThreshold,
        hours_remaining: Number(hoursToThreshold.toFixed(1)),
        failure_date: new Date(Date.now() + hoursToThreshold * 3600 * 1000)
      });
    }
  }

  // Current prediction
  if (currentTrend.trend > 0) {
    const hoursToThreshold = (currentThreshold - currentTrend.lastSmoothedValue) / currentTrend.trend;
    if (hoursToThreshold > 0) {
      predictions.push({
        factor: "current",
        threshold: currentThreshold,
        hours_remaining: Number(hoursToThreshold.toFixed(1)),
        failure_date: new Date(Date.now() + hoursToThreshold * 3600 * 1000)
      });
    }
  }

  if (predictions.length === 0) {
    return {
      predicted: false,
      reason: "No degrading trends detected"
    };
  }

  // Sort by soonest failure
  predictions.sort((a, b) => a.hours_remaining - b.hours_remaining);

  return {
    predicted: true,
    critical_factor: predictions[0].factor,
    hours_to_maintenance: predictions[0].hours_remaining,
    maintenance_date: predictions[0].failure_date,
    all_predictions: predictions
  };
}

/**
 * Get maintenance recommendations
 */
export async function getMaintenanceRecommendations(motorId) {
  try {
    const degradation = await detectDegradationTrends(motorId, 168);

    if (degradation.error) {
      return { error: degradation.error };
    }

    const recommendations = [];

    if (degradation.risk_level === "CRITICAL") {
      recommendations.push({
        priority: "IMMEDIATE",
        action: "Schedule emergency maintenance",
        reason: "Critical degradation detected"
      });
    } else if (degradation.risk_level === "HIGH") {
      if (
        degradation.predicted_failure.predicted &&
        degradation.predicted_failure.hours_to_maintenance < 48
      ) {
        recommendations.push({
          priority: "URGENT",
          action: `Schedule maintenance within ${Math.ceil(degradation.predicted_failure.hours_to_maintenance / 24)} days`,
          reason: `${degradation.predicted_failure.critical_factor} approaching critical threshold`,
          predicted_date: degradation.predicted_failure.maintenance_date
        });
      }
    }

    // Specific maintenance actions based on factors
    for (const factor of degradation.risk_factors) {
      if (factor.includes("Temperature")) {
        recommendations.push({
          priority: "HIGH",
          action: "Check cooling system and ventilation",
          reason: "Temperature trending upward"
        });
      }
      if (factor.includes("Vibration")) {
        recommendations.push({
          priority: "HIGH",
          action: "Check bearings and alignment",
          reason: "Vibration increasing significantly"
        });
      }
      if (factor.includes("Current")) {
        recommendations.push({
          priority: "MEDIUM",
          action: "Inspect load and motor windings",
          reason: "Current draw increasing"
        });
      }
      if (factor.includes("abnormal state")) {
        recommendations.push({
          priority: "MEDIUM",
          action: "Monitor for intermittent failures",
          reason: "Frequent abnormal states detected"
        });
      }
    }

    return {
      motor_id: motorId,
      risk_level: degradation.risk_level,
      recommendations: recommendations,
      analysis_timestamp: new Date()
    };
  } catch (error) {
    logger.error("Maintenance recommendations failed", { motorId, error: error.message });
    return { error: error.message };
  }
}

/**
 * Get maintenance history and schedule
 */
export async function getMaintenanceSchedule(motorId) {
  try {
    const db = getDb();
    const schedule = await db.collection("maintenance_schedule").find({ motor_id: motorId }).toArray();

    return {
      motor_id: motorId,
      scheduled_maintenance: schedule,
      total_count: schedule.length
    };
  } catch (error) {
    logger.error("Maintenance schedule fetch failed", { motorId, error: error.message });
    return { error: error.message };
  }
}

/**
 * Log maintenance action
 */
export async function logMaintenanceAction(motorId, actionType, notes = "") {
  try {
    const db = getDb();
    const doc = {
      motor_id: motorId,
      action_type: actionType,
      timestamp: new Date(),
      notes,
      scheduled_next_check: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week default
    };

    const result = await db.collection("maintenance_log").insertOne(doc);
    return {
      success: true,
      maintenance_id: result.insertedId,
      message: `Maintenance action logged: ${actionType}`
    };
  } catch (error) {
    logger.error("Maintenance logging failed", { motorId, error: error.message });
    return { error: error.message };
  }
}
