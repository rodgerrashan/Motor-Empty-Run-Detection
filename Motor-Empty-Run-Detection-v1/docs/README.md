# ESP32 Prototype Node Docs

## Module documentation

- `docs/modules/config.md`
- `docs/modules/wifi.md`
- `docs/modules/mqtt.md`
- `docs/modules/acs712.md`
- `docs/modules/voltage-divider.md`
- `docs/modules/mpu6050.md`
- `docs/modules/relay.md`
- `docs/modules/telemetry.md`
- `docs/modules/main.md`

## Wiring (suggested)

ESP32 (NodeMCU-32S default):

- ACS712 Vout → GPIO34 (ADC)
- Voltage divider output → GPIO35 (ADC)
- MPU6050:
  - SDA → GPIO21
  - SCL → GPIO22
  - VCC → 3.3V (preferred)
  - GND → GND
- Relay control:
  - Relay IN (module) or transistor base resistor input → GPIO26
  - Relay VCC → 5V
  - Relay GND → GND

## Critical safety notes

- ESP32 ADC inputs must stay **≤ 3.3V**.
  - If your ACS712 board is powered at 5V, its output can exceed 3.3V.
  - Use a divider on ACS712 Vout or power the board at 3.3V (if it works reliably).
- Relay coil cannot be driven directly from ESP32 GPIO.
  - Use a relay **module** (recommended) or a transistor driver + flyback diode.
- Put a flyback diode across the DC motor terminals unless your driver module already includes suppression.

## Calibration checklist

All calibration constants live in `include/AppConfig.h`.

1. ACS712 offset:
   - Firmware measures offset at startup. Ensure motor is OFF during the first few seconds.
2. ACS712 sensitivity:
   - Start with `ACS_SENS_V_PER_A` typical value (20A module is often ~0.100 V/A).
   - Tune by comparing to a multimeter (or known load).
3. Voltage divider scale:
   - Set `VDIV_SCALE` to match your resistor ratio.

## Prototype “empty-run” demo

Since this is a DC motor, simulate empty-run as **no-load** (current drops) vs **loaded** (current rises).

- When RPM is high and current drops below threshold, firmware sets `alert_code=1`.
- Backend/UI will show alerts based on `alert_code` even if the ONNX model is not trained for your DC setup.
