# Motor-Empty-Run-Detection-v1 (ESP32 Prototype Node)

This PlatformIO project is an ESP32 sensor/actuator node that publishes MQTT telemetry compatible with the main repository backend.

It is intended for a **prototype demo** using:

- DC motor as “pump” motor
- ACS712 20A current sensor (analog)
- Voltage divider for motor supply voltage (analog)
- MPU6050 accelerometer (I2C) for vibration estimate + temperature proxy
- SRD-05VDC-SL-C relay module/driver for motor ON/OFF

## MQTT compatibility

The backend requires these JSON fields per message:

- `motor_id`
- `rpm`
- `vibration_hz`
- `current_amp`
- `temperature_c`
- `power_factor`

Default MQTT topic is `edge_ai/motor_efficiency`.

## Quick start

1. Edit Wi-Fi and MQTT settings in `include/AppConfig.h`.
2. Wire sensors as described in `docs/README.md`.
3. Build + flash via PlatformIO.
4. Start the stack in the main repo: `docker compose up --build`.
   - Set `MQTT_HOST` in `include/AppConfig.h` to your PC LAN IP running Mosquitto.

## Documentation

- `docs/README.md` (wiring + calibration)
- `docs/modules/*` (module-by-module docs)
