/**
 * Alert Rules Engine
 * Customizable alerting system with rule-based conditions
 */

import { getDb } from "../db/mongo.js";
import { logger } from "../logger.js";
import { broadcast } from "../realtime/wsHub.js";

/**
 * Predefined rule templates
 */
export const RULE_TEMPLATES = {
  TEMPERATURE_HIGH: {
    name: "High Temperature Alert",
    condition: "raw.temperature_c > 75",
    description: "Triggers when motor temperature exceeds 75°C",
    severity: "WARNING"
  },
  TEMPERATURE_CRITICAL: {
    name: "Critical Temperature",
    condition: "raw.temperature_c > 85",
    description: "Triggers when motor temperature exceeds 85°C",
    severity: "CRITICAL"
  },
  VIBRATION_HIGH: {
    name: "High Vibration",
    condition: "raw.vibration_hz > 100",
    description: "Triggers when vibration exceeds 100 Hz",
    severity: "WARNING"
  },
  VIBRATION_CRITICAL: {
    name: "Critical Vibration",
    condition: "raw.vibration_hz > 130",
    description: "Triggers when vibration exceeds 130 Hz",
    severity: "CRITICAL"
  },
  CURRENT_HIGH: {
    name: "High Current Draw",
    condition: "raw.current_amp > 25",
    description: "Triggers when current exceeds 25 A",
    severity: "WARNING"
  },
  POWER_FACTOR_LOW: {
    name: "Low Power Factor",
    condition: "raw.power_factor < 0.85",
    description: "Triggers when power factor drops below 0.85",
    severity: "WARNING"
  },
  EMPTY_RUN: {
    name: "Empty Run Detected",
    condition: "predicted_state === 'EMPTY_RUN'",
    description: "Triggers when motor is detected in empty run state",
    severity: "CRITICAL"
  },
  STALLED: {
    name: "Motor Stalled",
    condition: "predicted_state === 'STALLED'",
    description: "Triggers when motor is stalled",
    severity: "CRITICAL"
  },
  LOW_CONFIDENCE: {
    name: "Low Model Confidence",
    condition: "confidence < 0.7",
    description: "Triggers when model confidence is below 70%",
    severity: "INFO"
  }
};

/**
 * Create custom alert rule
 */
export async function createAlertRule(motorId, ruleData) {
  try {
    const db = getDb();

    const rule = {
      motor_id: motorId,
      name: ruleData.name,
      description: ruleData.description || "",
      condition: ruleData.condition,
      severity: ruleData.severity || "WARNING",
      enabled: ruleData.enabled !== false,
      created_at: new Date(),
      updated_at: new Date(),
      trigger_count: 0,
      last_triggered: null
    };

    // Validate rule
    const validationResult = validateRule(rule);
    if (!validationResult.valid) {
      return { error: `Invalid rule: ${validationResult.error}` };
    }

    const result = await db.collection("alert_rules").insertOne(rule);

    return {
      success: true,
      rule_id: result.insertedId,
      message: "Alert rule created successfully"
    };
  } catch (error) {
    logger.error("Alert rule creation failed", { motorId, error: error.message });
    return { error: error.message };
  }
}

/**
 * Validate alert rule
 */
function validateRule(rule) {
  if (!rule.name || rule.name.trim().length === 0) {
    return { valid: false, error: "Rule name required" };
  }

  if (!rule.condition || rule.condition.trim().length === 0) {
    return { valid: false, error: "Condition required" };
  }

  if (!["INFO", "WARNING", "CRITICAL"].includes(rule.severity)) {
    return { valid: false, error: "Invalid severity level" };
  }

  // Basic condition validation (simple check)
  if (!rule.condition.includes("raw.") && !rule.condition.includes("predicted_state") && !rule.condition.includes("confidence")) {
    return { valid: false, error: "Condition must reference valid fields" };
  }

  return { valid: true };
}

/**
 * Get all rules for a motor
 */
export async function getAlertRules(motorId) {
  try {
    const db = getDb();
    const rules = await db.collection("alert_rules").find({ motor_id: motorId }).toArray();

    return {
      motor_id: motorId,
      total_rules: rules.length,
      rules: rules,
      templates: Object.entries(RULE_TEMPLATES).map(([key, template]) => ({
        template_id: key,
        ...template
      }))
    };
  } catch (error) {
    logger.error("Alert rules fetch failed", { motorId, error: error.message });
    return { error: error.message };
  }
}

/**
 * Evaluate rules against telemetry
 */
export async function evaluateRules(motorId, telemetryDoc) {
  try {
    const db = getDb();
    const rules = await db.collection("alert_rules").find({ motor_id: motorId, enabled: true }).toArray();

    const triggeredAlerts = [];

    for (const rule of rules) {
      if (evaluateCondition(rule.condition, telemetryDoc)) {
        // Create alert
        const alertDoc = {
          motor_id: motorId,
          rule_id: rule._id,
          rule_name: rule.name,
          severity: rule.severity,
          created_at: new Date(),
          event_time: telemetryDoc.event_time,
          telemetry_id: telemetryDoc._id,
          condition: rule.condition,
          message: generateAlertMessage(rule, telemetryDoc)
        };

        await db.collection("rule_alerts").insertOne(alertDoc);
        triggeredAlerts.push(alertDoc);

        // Update rule trigger count
        await db.collection("alert_rules").updateOne(
          { _id: rule._id },
          {
            $set: { last_triggered: new Date() },
            $inc: { trigger_count: 1 }
          }
        );

        // Broadcast alert
        broadcast("rule_alert", alertDoc);
      }
    }

    return triggeredAlerts;
  } catch (error) {
    logger.error("Rule evaluation failed", { motorId, error: error.message });
    return [];
  }
}

/**
 * Evaluate condition against telemetry data
 */
function evaluateCondition(condition, telemetryDoc) {
  try {
    // Create evaluation context
    const context = {
      raw: telemetryDoc.raw,
      engineered: telemetryDoc.engineered,
      predicted_state: telemetryDoc.predicted_state,
      confidence: telemetryDoc.confidence
    };

    // Safe evaluation
    // eslint-disable-next-line no-new-func
    const evaluator = new Function("data", `return (${condition.replace(/\braw\b/g, "data.raw").replace(/\bpredicted_state\b/g, "data.predicted_state").replace(/\bconfidence\b/g, "data.confidence").replace(/\bengineered\b/g, "data.engineered")})`);

    return evaluator(context) === true;
  } catch (error) {
    logger.warn("Condition evaluation error", { condition, error: error.message });
    return false;
  }
}

/**
 * Generate human-readable alert message
 */
function generateAlertMessage(rule, telemetryDoc) {
  const messages = [];

  // Extract trigger values
  if (telemetryDoc.raw.temperature_c !== undefined) {
    messages.push(`Temperature: ${telemetryDoc.raw.temperature_c.toFixed(1)}°C`);
  }
  if (telemetryDoc.raw.vibration_hz !== undefined) {
    messages.push(`Vibration: ${telemetryDoc.raw.vibration_hz.toFixed(1)} Hz`);
  }
  if (telemetryDoc.raw.current_amp !== undefined) {
    messages.push(`Current: ${telemetryDoc.raw.current_amp.toFixed(2)} A`);
  }
  if (telemetryDoc.raw.power_factor !== undefined) {
    messages.push(`Power Factor: ${telemetryDoc.raw.power_factor.toFixed(3)}`);
  }

  return `${rule.name}: ${messages.join(" | ")}`;
}

/**
 * Update alert rule
 */
export async function updateAlertRule(ruleId, updateData) {
  try {
    const db = getDb();

    const updatedRule = {
      ...updateData,
      updated_at: new Date()
    };

    // Validate rule
    const validationResult = validateRule(updatedRule);
    if (!validationResult.valid) {
      return { error: `Invalid rule: ${validationResult.error}` };
    }

    const result = await db.collection("alert_rules").updateOne(
      { _id: ruleId },
      { $set: updatedRule }
    );

    if (result.matchedCount === 0) {
      return { error: "Rule not found" };
    }

    return { success: true, message: "Rule updated successfully" };
  } catch (error) {
    logger.error("Alert rule update failed", { error: error.message });
    return { error: error.message };
  }
}

/**
 * Delete alert rule
 */
export async function deleteAlertRule(ruleId) {
  try {
    const db = getDb();
    const result = await db.collection("alert_rules").deleteOne({ _id: ruleId });

    if (result.deletedCount === 0) {
      return { error: "Rule not found" };
    }

    return { success: true, message: "Rule deleted successfully" };
  } catch (error) {
    logger.error("Alert rule deletion failed", { error: error.message });
    return { error: error.message };
  }
}

/**
 * Get rule alerts history
 */
export async function getRuleAlertsHistory(motorId, limit = 100, hoursBack = 24) {
  try {
    const db = getDb();
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const alerts = await db
      .collection("rule_alerts")
      .find({
        motor_id: motorId,
        created_at: { $gte: cutoffTime }
      })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();

    return {
      motor_id: motorId,
      total_alerts: alerts.length,
      lookback_hours: hoursBack,
      alerts: alerts
    };
  } catch (error) {
    logger.error("Rule alerts history fetch failed", { motorId, error: error.message });
    return { error: error.message };
  }
}

/**
 * Get rule statistics
 */
export async function getRuleStatistics(motorId) {
  try {
    const db = getDb();
    const rules = await db.collection("alert_rules").find({ motor_id: motorId }).toArray();

    const stats = {
      motor_id: motorId,
      total_rules: rules.length,
      enabled_rules: rules.filter((r) => r.enabled).length,
      disabled_rules: rules.filter((r) => !r.enabled).length,
      top_triggered: rules
        .sort((a, b) => (b.trigger_count || 0) - (a.trigger_count || 0))
        .slice(0, 5)
        .map((r) => ({
          name: r.name,
          trigger_count: r.trigger_count || 0,
          last_triggered: r.last_triggered
        }))
    };

    return stats;
  } catch (error) {
    logger.error("Rule statistics fetch failed", { motorId, error: error.message });
    return { error: error.message };
  }
}
