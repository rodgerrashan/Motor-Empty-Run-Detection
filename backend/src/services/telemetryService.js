import { getDb } from "../db/mongo.js";
import { buildFeatureVector } from "../ml/featureEngineering.js";
import { predict } from "../ml/onnxService.js";
import { broadcast } from "../realtime/wsHub.js";
import { registerPrediction } from "./evaluationService.js";
import { evaluateRules } from "./alertRulesEngine.js";

function toDate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return new Date();
  return new Date(n > 1e12 ? n : n * 1000);
}

function validatePayload(payload) {
  const required = ["motor_id", "rpm", "vibration_hz", "current_amp", "temperature_c", "power_factor"];
  const missing = required.filter((field) => payload[field] == null);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
}

export async function processTelemetry(payload) {
  validatePayload(payload);

  const db = getDb();
  const features = buildFeatureVector(payload);
  const inference = await predict(features);

  const telemetryDoc = {
    motor_id: String(payload.motor_id),
    event_time: toDate(payload.timestamp),
    raw: {
      rpm: Number(payload.rpm),
      vibration_hz: Number(payload.vibration_hz),
      current_amp: Number(payload.current_amp),
      temperature_c: Number(payload.temperature_c),
      power_factor: Number(payload.power_factor)
    },
    engineered: features,
    source_state: payload.state ?? null,
    source_status: payload.status ?? null,
    predicted_state: inference.predictedState,
    confidence: inference.confidence,
    probabilities: inference.probabilities,
    description: payload.description ?? null,
    alert_code: Number(payload.alert_code ?? 0),
    ingest_time: new Date()
  };

  await db.collection("telemetry").insertOne(telemetryDoc);
  broadcast("telemetry", telemetryDoc);

  const abnormalStates = new Set(["EMPTY_RUN", "STALLED", "OFF"]);
  if (abnormalStates.has(inference.predictedState) || telemetryDoc.alert_code > 0) {
    const alertDoc = {
      motor_id: telemetryDoc.motor_id,
      created_at: new Date(),
      event_time: telemetryDoc.event_time,
      predicted_state: telemetryDoc.predicted_state,
      confidence: telemetryDoc.confidence,
      source_status: telemetryDoc.source_status,
      alert_code: telemetryDoc.alert_code
    };
    await db.collection("alerts").insertOne(alertDoc);
    broadcast("alert", alertDoc);
  }

  const evalDoc = registerPrediction({
    predicted_state: telemetryDoc.predicted_state,
    confidence: telemetryDoc.confidence
  });

  if (evalDoc) {
    await db.collection("model_eval").insertOne(evalDoc);
    broadcast("model_eval", evalDoc);
  }

  // Evaluate custom alert rules
  const ruleAlerts = await evaluateRules(telemetryDoc.motor_id, telemetryDoc);
  if (ruleAlerts.length > 0) {
    ruleAlerts.forEach((alert) => broadcast("rule_alert", alert));
  }

  return telemetryDoc;
}
