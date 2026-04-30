/**
 * Energy Metrics & Efficiency Service
 * Tracks power consumption, efficiency trends, and carbon footprint
 */

import { getDb } from "../db/mongo.js";
import { logger } from "../logger.js";

const CARBON_INTENSITY = 0.233; // kg CO2 per kWh (average grid)
const POWER_COST = 0.12; // $ per kWh

/**
 * Calculate energy metrics for a motor
 */
export async function calculateEnergyMetrics(motorId, windowMinutes = 60) {
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

    if (telemetry.length === 0) {
      return { error: "No telemetry data" };
    }

    // Calculate energy consumption
    let totalEnergyKwh = 0;
    let totalPowerKw = 0;
    let totalCurrentAmp = 0;
    const voltageNominal = 230; // Assuming 230V single-phase

    const powerFactors = [];
    const currentReadings = [];
    const timestamps = [];

    for (const t of telemetry) {
      const power = t.engineered.power_kw || (t.raw.current_amp * voltageNominal * t.raw.power_factor) / 1000;
      totalPowerKw += power;
      totalCurrentAmp += t.raw.current_amp;
      powerFactors.push(t.raw.power_factor);
      currentReadings.push(t.raw.current_amp);
      timestamps.push(new Date(t.event_time));
    }

    const avgPowerKw = totalPowerKw / telemetry.length;
    const avgCurrentAmp = totalCurrentAmp / telemetry.length;
    const avgPowerFactor = powerFactors.reduce((a, b) => a + b, 0) / powerFactors.length;

    // Energy calculation: Power * Time
    const timeHours = (timestamps[timestamps.length - 1] - timestamps[0]) / (3600 * 1000);
    const totalEnergyKwhCalculated = avgPowerKw * Math.max(timeHours, windowMinutes / 60);

    // Efficiency metrics
    const efficiency = calculateEfficiencyIndex(telemetry);

    // Cost and emissions
    const costUsd = totalEnergyKwhCalculated * POWER_COST;
    const carbonKg = totalEnergyKwhCalculated * CARBON_INTENSITY;

    return {
      motor_id: motorId,
      window_minutes: windowMinutes,
      sample_count: telemetry.length,
      energy: {
        total_kwh: Number(totalEnergyKwhCalculated.toFixed(3)),
        avg_power_kw: Number(avgPowerKw.toFixed(3)),
        avg_current_amp: Number(avgCurrentAmp.toFixed(2)),
        avg_power_factor: Number(avgPowerFactor.toFixed(3))
      },
      cost: {
        estimated_usd: Number(costUsd.toFixed(2)),
        rate_usd_per_kwh: POWER_COST
      },
      emissions: {
        carbon_kg: Number(carbonKg.toFixed(3)),
        carbon_intensity_kg_per_kwh: CARBON_INTENSITY,
        equivalent_tree_hours: Number((carbonKg / 0.024).toFixed(1)) // ~24g CO2/tree/hour
      },
      efficiency: efficiency,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error("Energy metrics calculation failed", { motorId, error: error.message });
    return { error: error.message };
  }
}

/**
 * Calculate efficiency index based on power factor and current stability
 * Returns 0-100 score where 100 is best efficiency
 */
function calculateEfficiencyIndex(telemetry) {
  const powerFactors = telemetry.map((t) => t.raw.power_factor).filter((v) => typeof v === "number");
  const currents = telemetry.map((t) => t.raw.current_amp).filter((v) => typeof v === "number");

  let efficiencyScore = 100;

  // Power factor contribution (ideal is 1.0)
  if (powerFactors.length > 0) {
    const avgPF = powerFactors.reduce((a, b) => a + b, 0) / powerFactors.length;
    const pfScore = Math.max(0, avgPF * 100); // 0.95 PF = 95 score
    efficiencyScore -= (100 - pfScore) * 0.5;
  }

  // Current stability contribution (low variance is good)
  if (currents.length > 1) {
    const currentMean = currents.reduce((a, b) => a + b, 0) / currents.length;
    const currentVar =
      currents.reduce((acc, c) => acc + Math.pow(c - currentMean, 2), 0) / currents.length;
    const currentStdDev = Math.sqrt(currentVar);
    const stabilityPercent = (currentStdDev / Math.max(currentMean, 0.1)) * 100;
    const stabilityScore = Math.max(0, 100 - stabilityPercent);
    efficiencyScore -= (100 - stabilityScore) * 0.5;
  }

  return {
    score: Number(Math.max(0, Math.min(100, efficiencyScore)).toFixed(1)),
    rating:
      efficiencyScore >= 90
        ? "EXCELLENT"
        : efficiencyScore >= 75
          ? "GOOD"
          : efficiencyScore >= 60
            ? "FAIR"
            : "POOR"
  };
}

/**
 * Get energy trends over time
 */
export async function getEnergyTrends(motorId, intervalHours = 1, lookbackHours = 24) {
  try {
    const db = getDb();
    const trends = [];

    for (let i = 0; i < lookbackHours; i++) {
      const windowMinutes = intervalHours * 60;
      const endTime = Date.now() - i * windowMinutes * 60 * 1000;
      const startTime = endTime - windowMinutes * 60 * 1000;

      const telemetry = await db
        .collection("telemetry")
        .find({
          motor_id: motorId,
          event_time: { $gte: new Date(startTime), $lt: new Date(endTime) }
        })
        .toArray();

      if (telemetry.length > 0) {
        const avgPowerKw =
          telemetry.reduce((acc, t) => acc + (t.engineered.power_kw || 0), 0) / telemetry.length;
        const energyKwh = (avgPowerKw * intervalHours).toFixed(3);

        trends.push({
          hour: i,
          timestamp: new Date(endTime),
          energy_kwh: Number(energyKwh),
          avg_power_kw: Number(avgPowerKw.toFixed(3)),
          sample_count: telemetry.length,
          cost_usd: Number((Number(energyKwh) * POWER_COST).toFixed(2)),
          carbon_kg: Number((Number(energyKwh) * CARBON_INTENSITY).toFixed(3))
        });
      }
    }

    return trends.reverse();
  } catch (error) {
    logger.error("Energy trends fetch failed", { motorId, error: error.message });
    return [];
  }
}

/**
 * Get energy comparison with baseline
 */
export async function getEnergyOptimization(motorId, windowMinutes = 1440) {
  try {
    const db = getDb();
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);

    const telemetry = await db
      .collection("telemetry")
      .find({
        motor_id: motorId,
        event_time: { $gte: cutoffTime }
      })
      .toArray();

    if (telemetry.length === 0) {
      return { error: "No data" };
    }

    // Current metrics
    const currentMetrics = await calculateEnergyMetrics(motorId, windowMinutes);

    // Get metrics from same period but different lookback (historical baseline)
    const historicalTelemetry = await db
      .collection("telemetry")
      .find({
        motor_id: motorId,
        event_time: {
          $gte: new Date(Date.now() - windowMinutes * 2 * 60 * 1000),
          $lt: new Date(Date.now() - windowMinutes * 60 * 1000)
        }
      })
      .toArray();

    if (historicalTelemetry.length === 0) {
      return { ...currentMetrics, improvement: "N/A - No historical data" };
    }

    // Calculate improvement
    const historicalAvgPower =
      historicalTelemetry.reduce((acc, t) => acc + (t.engineered.power_kw || 0), 0) /
      historicalTelemetry.length;
    const currentAvgPower = currentMetrics.energy.avg_power_kw;

    const improvementPercent = ((historicalAvgPower - currentAvgPower) / historicalAvgPower) * 100;

    return {
      ...currentMetrics,
      improvement: {
        percent: Number(improvementPercent.toFixed(1)),
        direction: improvementPercent > 0 ? "IMPROVED" : "DEGRADED",
        historical_avg_power_kw: Number(historicalAvgPower.toFixed(3))
      }
    };
  } catch (error) {
    logger.error("Energy optimization analysis failed", { motorId, error: error.message });
    return { error: error.message };
  }
}

/**
 * Calculate cost savings potential
 */
export async function getCostSavingsPotential(motorId, windowMinutes = 1440) {
  try {
    const metrics = await calculateEnergyMetrics(motorId, windowMinutes);

    if (metrics.error) {
      return { error: metrics.error };
    }

    const efficiency = metrics.efficiency.score;
    const currentCost = metrics.cost.estimated_usd;

    // Estimate what cost would be with better efficiency
    const potentialCost = currentCost * (efficiency / 100);
    const savingsPotential = currentCost - potentialCost;

    // Annualized estimate
    const annualizedCurrent = currentCost * 365;
    const annualizedPotential = potentialCost * 365;
    const annualSavings = annualizedCurrent - annualizedPotential;

    return {
      motor_id: motorId,
      window_minutes: windowMinutes,
      current_efficiency_score: efficiency,
      current_cost: currentCost,
      potential_cost_optimized: Number(potentialCost.toFixed(2)),
      immediate_savings_potential: Number(savingsPotential.toFixed(2)),
      annualized_savings: Number(annualSavings.toFixed(2)),
      carbon_reduction_kg: Number((savingsPotential / POWER_COST * CARBON_INTENSITY).toFixed(2)),
      recommendations: generateEfficiencyRecommendations(metrics)
    };
  } catch (error) {
    logger.error("Cost savings calculation failed", { motorId, error: error.message });
    return { error: error.message };
  }
}

/**
 * Generate efficiency recommendations
 */
function generateEfficiencyRecommendations(metrics) {
  const recommendations = [];

  if (metrics.efficiency.score < 70) {
    recommendations.push("Consider motor maintenance - efficiency has degraded");
  }

  if (metrics.energy.avg_power_factor < 0.9) {
    recommendations.push("Low power factor detected - consider power factor correction");
  }

  if (metrics.energy.avg_current_amp > 25) {
    recommendations.push("High current draw - check for overload or mechanical issues");
  }

  return recommendations;
}
