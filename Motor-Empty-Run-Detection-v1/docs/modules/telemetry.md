# TelemetryPayload module

Files:

- `include/TelemetryPayload.h`
- `src/TelemetryPayload.cpp`

## Purpose

- Hold the telemetry fields that must be published to MQTT.
- Serialize to JSON using ArduinoJson.

## Backend-required fields

- `motor_id`
- `rpm`
- `vibration_hz`
- `current_amp`
- `temperature_c`
- `power_factor`

## Optional fields

- `status`, `state`, `alert_code`, `motor_voltage_v`

The backend stores these when present.
