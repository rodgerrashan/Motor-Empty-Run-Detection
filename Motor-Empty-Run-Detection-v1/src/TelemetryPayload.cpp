#include "TelemetryPayload.h"

#include <ArduinoJson.h>

bool TelemetryPayload::toJson(char* out, size_t outLen) const {
  // ArduinoJson v7: prefer JsonDocument (elastic capacity).
  JsonDocument doc;

  doc["timestamp"] = timestamp_s;
  doc["motor_id"] = motor_id;
  doc["rpm"] = rpm;
  doc["vibration_hz"] = vibration_hz;
  doc["current_amp"] = current_amp;
  doc["temperature_c"] = temperature_c;
  doc["power_factor"] = power_factor;

  if (status) doc["status"] = status;
  if (state) doc["state"] = state;
  doc["alert_code"] = alert_code;

  // Extra debug signal (not required)
  doc["motor_voltage_v"] = motor_voltage_v;

  size_t written = serializeJson(doc, out, outLen);
  return written > 0 && written < outLen;
}
