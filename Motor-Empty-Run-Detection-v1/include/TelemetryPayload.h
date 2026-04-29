#pragma once

#include <cstddef>

struct TelemetryPayload {
  // Required by backend
  const char* motor_id;
  float timestamp_s;
  float rpm;
  float vibration_hz;
  float current_amp;
  float temperature_c;
  float power_factor;

  // Optional fields (backend will store and forward)
  const char* status;
  const char* state;
  int alert_code;
  float motor_voltage_v;

  // Serialize to JSON string. Returns true if it fit in buffer.
  bool toJson(char* out, size_t outLen) const;
};
