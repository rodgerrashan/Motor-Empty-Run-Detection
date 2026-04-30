import { config } from "../config.js";
import { logger } from "../logger.js";
import { sendCriticalAlertEmail } from "./emailService.js";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCriticalSignals(telemetryDoc) {
  const signals = [];
  const state = String(telemetryDoc.predicted_state || "").toUpperCase();
  const alertCode = toNumber(telemetryDoc.alert_code) || 0;
  const rpm = toNumber(telemetryDoc.raw?.rpm);
  const current = toNumber(telemetryDoc.raw?.current_amp);
  const vibration = toNumber(telemetryDoc.raw?.vibration_hz);
  const temperature = toNumber(telemetryDoc.raw?.temperature_c);

  if (["EMPTY_RUN", "STALLED", "OFF"].includes(state)) {
    signals.push({ key: `STATE:${state}`, label: `Predicted state: ${state}` });
  }

  if (alertCode > 0) {
    signals.push({ key: `ALERT:${alertCode}`, label: `Source alert code: ${alertCode}` });
  }

  if (temperature != null && temperature >= config.alerting.criticalTemperatureC) {
    signals.push({
      key: "TEMP_HIGH",
      label: `Temperature high: ${temperature.toFixed(1)} C >= ${config.alerting.criticalTemperatureC} C`
    });
  }

  if (vibration != null && vibration >= config.alerting.criticalVibrationHz) {
    signals.push({
      key: "VIBRATION_HIGH",
      label: `Vibration high: ${vibration.toFixed(1)} Hz >= ${config.alerting.criticalVibrationHz} Hz`
    });
  }

  if (
    current != null &&
    rpm != null &&
    current >= config.alerting.lockedRotorCurrentA &&
    rpm <= config.alerting.lockedRotorRpm
  ) {
    signals.push({
      key: "LOCKED_ROTOR",
      label: `Locked rotor risk: ${current.toFixed(1)} A and ${rpm.toFixed(0)} RPM`
    });
  }

  const uniqueSignals = signals.filter((signal, index, arr) => arr.findIndex((item) => item.key === signal.key) === index);
  const signature = uniqueSignals.map((signal) => signal.key).sort().join("|");

  return {
    signature,
    labels: uniqueSignals.map((signal) => signal.label)
  };
}

function buildEmailContent(telemetryDoc, labels) {
  const eventTime = telemetryDoc.event_time instanceof Date ? telemetryDoc.event_time.toISOString() : new Date().toISOString();
  const confidence = toNumber(telemetryDoc.confidence);
  const summaryLines = [
    `Motor ID: ${telemetryDoc.motor_id}`,
    `Time: ${eventTime}`,
    `Predicted state: ${telemetryDoc.predicted_state || "UNKNOWN"}`,
    `Confidence: ${confidence == null ? "n/a" : confidence.toFixed(4)}`,
    `Alert code: ${telemetryDoc.alert_code ?? 0}`,
    "",
    "Critical conditions detected:",
    ...labels.map((label) => `- ${label}`),
    "",
    "Latest measurements:",
    `- RPM: ${telemetryDoc.raw?.rpm ?? "n/a"}`,
    `- Vibration: ${telemetryDoc.raw?.vibration_hz ?? "n/a"} Hz`,
    `- Current: ${telemetryDoc.raw?.current_amp ?? "n/a"} A`,
    `- Temperature: ${telemetryDoc.raw?.temperature_c ?? "n/a"} C`,
    `- Power factor: ${telemetryDoc.raw?.power_factor ?? "n/a"}`
  ];

  const subject = `[Motor Alert] ${telemetryDoc.motor_id} - ${telemetryDoc.predicted_state || "UNKNOWN"}`;
  const text = summaryLines.join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Motor critical alert</h2>
      <p><strong>Motor ID:</strong> ${telemetryDoc.motor_id}</p>
      <p><strong>Time:</strong> ${eventTime}</p>
      <p><strong>Predicted state:</strong> ${telemetryDoc.predicted_state || "UNKNOWN"}</p>
      <p><strong>Confidence:</strong> ${confidence == null ? "n/a" : confidence.toFixed(4)}</p>
      <p><strong>Alert code:</strong> ${telemetryDoc.alert_code ?? 0}</p>
      <h3 style="margin: 18px 0 8px;">Critical conditions</h3>
      <ul>${labels.map((label) => `<li>${label}</li>`).join("")}</ul>
      <h3 style="margin: 18px 0 8px;">Latest measurements</h3>
      <ul>
        <li>RPM: ${telemetryDoc.raw?.rpm ?? "n/a"}</li>
        <li>Vibration: ${telemetryDoc.raw?.vibration_hz ?? "n/a"} Hz</li>
        <li>Current: ${telemetryDoc.raw?.current_amp ?? "n/a"} A</li>
        <li>Temperature: ${telemetryDoc.raw?.temperature_c ?? "n/a"} C</li>
        <li>Power factor: ${telemetryDoc.raw?.power_factor ?? "n/a"}</li>
      </ul>
    </div>`;

  return { subject, text, html };
}

export async function maybeSendCriticalAlert(db, telemetryDoc) {
  if (!config.alerting.enabled) {
    return { shouldSend: false, reason: "disabled" };
  }

  const { signature, labels } = buildCriticalSignals(telemetryDoc);
  if (!signature) {
    return { shouldSend: false, reason: "not_critical" };
  }

  const collection = db.collection("alert_notifications");
  const lastNotification = await collection.findOne(
    { motor_id: telemetryDoc.motor_id, condition_key: signature },
    { sort: { sent_at: -1 } }
  );

  if (lastNotification?.sent_at) {
    const lastSentAt = new Date(lastNotification.sent_at).getTime();
    const now = Date.now();
    const throttleMs = config.alerting.emailThrottleMinutes * 60 * 1000;
    if (Number.isFinite(lastSentAt) && now - lastSentAt < throttleMs) {
      logger.info("Critical alert email throttled", {
        motorId: telemetryDoc.motor_id,
        conditionKey: signature,
        minutesSinceLast: Math.floor((now - lastSentAt) / 60000)
      });
      return { shouldSend: false, reason: "throttled", signature, labels };
    }
  }

  const message = buildEmailContent(telemetryDoc, labels);
  const sendResult = await sendCriticalAlertEmail({
    motorId: telemetryDoc.motor_id,
    subject: message.subject,
    text: message.text,
    html: message.html
  });

  if (sendResult.sent) {
    await collection.insertOne({
      motor_id: telemetryDoc.motor_id,
      condition_key: signature,
      labels,
      sent_at: new Date(),
      event_time: telemetryDoc.event_time,
      predicted_state: telemetryDoc.predicted_state,
      confidence: telemetryDoc.confidence,
      alert_code: telemetryDoc.alert_code,
      subject: message.subject
    });
  }

  return { shouldSend: sendResult.sent, signature, labels, reason: sendResult.sent ? "sent" : sendResult.reason || "skipped" };
}