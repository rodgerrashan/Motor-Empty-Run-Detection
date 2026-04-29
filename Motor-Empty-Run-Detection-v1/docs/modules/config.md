# AppConfig module

Files:

- `include/AppConfig.h`

## Purpose

Central configuration for the prototype node:

- Wi‑Fi credentials
- MQTT host/port/topic/client id
- Motor identity (`motor_id`)
- Pin assignments
- Calibration constants (ACS712 sensitivity, divider scale)
- Demo logic thresholds (empty-run current threshold)

## What you must change

- `WIFI_SSID` / `WIFI_PASSWORD`
- `MQTT_HOST` (set to your PC/Laptop LAN IP running Mosquitto)

## Notes

- If your relay module is active-high instead of active-low, set `RELAY_ACTIVE_LOW=false`.
