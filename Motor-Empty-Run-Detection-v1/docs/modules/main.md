# main application module

Files:

- `src/main.cpp`

## Purpose

Orchestrates the full device behavior:

1. Initialize ADC + sensors
2. Connect Wi‑Fi
3. Connect MQTT
4. Calibrate ACS712 offset
5. Periodically read sensors and publish a backend-compatible telemetry JSON
6. Optionally drive the relay based on empty-run detection

## Timing

- Publish period: `AppConfig::PUBLISH_EVERY_MS`

## Empty-run demo logic

- Empty-run is detected when:
  - `rpm >= EMPTY_RUN_RPM_MIN` and `current_amp < EMPTY_RUN_CURRENT_A`

When empty-run is detected:

- Telemetry includes `alert_code=1`, `state=EMPTY_RUN`
- If `STOP_MOTOR_ON_EMPTY_RUN=true`, motor relay will turn OFF
