# VoltageDividerSensor module

Files:

- `include/sensors/VoltageDividerSensor.h`
- `src/VoltageDividerSensor.cpp`

## Purpose

- Read motor supply voltage through a resistor divider.

## Configuration

- `VDIV_SCALE` in `include/AppConfig.h`.
  - If your divider is Rtop (to Vin) and Rbottom (to GND), then:
    - `VDIV_SCALE = (Rtop + Rbottom) / Rbottom`

## Notes

- This voltage is sent as `motor_voltage_v` for debugging. The backend does not require it.
