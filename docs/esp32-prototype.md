# ESP32 Prototype (DC Motor + ACS712 + Voltage Divider + MPU6050)

This guide shows how to demo the project **without a real water pump**, using a **small DC motor** as the “pump motor” and your available sensors:

- **ACS712 20A current sensor** (analog)
- **Voltage divider** (analog) to measure motor supply voltage
- **MPU6050** (I2C) for vibration + temperature proxy

The ESP32 publishes MQTT telemetry to the existing backend topic (`edge_ai/motor_efficiency`) using the required JSON fields so you can run the full stack unchanged.

## 0) What the backend expects (must-match payload)

The backend validates every MQTT message has these fields:

- `motor_id`
- `rpm`
- `vibration_hz`
- `current_amp`
- `temperature_c`
- `power_factor`

See validation in [backend/src/services/telemetryService.js](../backend/src/services/telemetryService.js).

## 1) Minimal extra parts (recommended)

You can do it with only what you listed, but these small extras make it far easier and safer:

- **Logic-level MOSFET driver module** *or* a small DC motor driver (e.g. TB6612FNG)
  - lets the ESP32 control motor speed (PWM) so `rpm` can be estimated from duty cycle
- **Flyback diode** across the motor (if not already on the driver module)
- **Decoupling caps** near sensors (typical: 0.1uF + 10uF)

## 1.1) Adding a relay to turn the DC motor ON/OFF

You can use your **SRD-05VDC-SL-C** relay to switch the DC motor supply **ON/OFF**.

Important constraints:

- The relay coil is **5V** and typically draws **~70–90mA** (varies by module). An ESP32 GPIO cannot drive it directly.
- A relay is for **ON/OFF**, not PWM speed control (switching fast will wear the relay and create electrical noise).

### Option A (recommended): use a 1-channel relay module

If you have a relay *module* (relay + transistor driver + flyback diode, sometimes optocoupler):

- Relay module `VCC` → 5V
- Relay module `GND` → GND
- Relay module `IN` → ESP32 GPIO (e.g. GPIO26)

Notes:

- Many modules are **active-low** (IN=LOW turns relay ON). Check the silkscreen / LED behavior.
- Some opto-isolated modules require a separate `JD-VCC`/`VCC` wiring scheme. Follow your module’s labeling.

### Option B: drive the bare SRD-05VDC-SL-C using a transistor (no relay module)

Required extra parts:

- 1× NPN transistor (2N2222 / S8050 / BC547) **or** logic-level N-MOSFET
- 1× base/gate resistor (typical **1k–2.2k** for NPN)
- 1× flyback diode across the relay coil (1N4148 or 1N4007)

Wiring (NPN example):

- ESP32 GPIO26 → **1k resistor** → NPN base
- NPN emitter → GND
- Relay coil: one side → +5V, other side → NPN collector
- Flyback diode across relay coil: diode **cathode to +5V**, anode to collector side
- ESP32 GND and the 5V supply GND must be common.

### Switching the motor with the relay contacts

For DC motor supply switching:

- Supply `+` → Relay `COM`
- Relay `NO` → Motor `+`
- Motor `-` → Supply `-`

Add a **flyback diode across the motor terminals** too (cathode to motor `+`, anode to motor `-`) unless your motor driver already includes suppression.

If you want the motor to be OFF by default, use the **NO** contact. Use **NC** only if you specifically want default-ON behavior.

## 2) Wiring (prototype-friendly)

### ESP32 pins (suggested)

- ACS712 analog output → `GPIO34` (ADC)
- Voltage divider output → `GPIO35` (ADC)
- MPU6050:
  - SDA → `GPIO21`
  - SCL → `GPIO22`
  - VCC → 3.3V (preferred for ESP32 level compatibility)
  - GND → GND

Optional (relay input control):

- Relay IN (or transistor base resistor input) → `GPIO26`

### Important: ACS712 output must never exceed 3.3V

Many ACS712 modules are powered at **5V** by default and their analog output can swing close to 5V. The ESP32 ADC input is **3.3V max**.

Use one of these safe options:

- **Option A (recommended): power ACS712 at 3.3V**
  - Many modules work at 3.3V, but you must verify your board behaves correctly.
- **Option B: keep ACS712 at 5V but add a divider on Vout → ESP32 ADC**
  - Example divider ratio ~0.66 so 5V becomes 3.3V.
  - You *must* calibrate offset/sensitivity in firmware after scaling.

### Voltage divider for motor supply

- Choose resistor values so the divider output stays within **0–3.3V** at your max motor voltage.
- For example, for a 12V motor supply you might target ~3.0V at 12V.

## 3) How to simulate “empty run” with a DC motor

With a DC motor, the easiest demo is **load vs no-load**:

- **Loaded condition** (represents “normal pumping”): add mechanical load
  - press a rubber wheel against the shaft
  - add a small fan/impeller in air (moderate load)
  - add a belt + adjustable tension
- **Empty-run condition** (represents “dry/empty”): remove load so current drops

Your alert can be driven by a simple rule:

- if `current_amp` drops below a threshold while speed is high → set `alert_code = 1`

This creates alerts in the UI even if the ONNX model isn’t trained on your DC setup.

## 4) Firmware (Arduino) that publishes compatible telemetry

A ready-to-flash Arduino sketch is provided:

- [sensors/esp32_prototype/esp32_motor_node.ino](../sensors/esp32_prototype/esp32_motor_node.ino)

### What it does

- Reads current via ACS712 and reports `current_amp`
- Reads vibration using MPU6050 accelerometer and reports an approximate `vibration_hz`
- Uses MPU6050 internal temperature as `temperature_c` (good enough for demo)
- Estimates `rpm` from PWM duty cycle (demo-friendly)
- Publishes JSON to `edge_ai/motor_efficiency`

## 5) Run the full stack with your ESP32

1. Start the stack:

   ```bash
   docker compose up --build
   ```

2. Find your PC’s LAN IP (the MQTT broker is on your PC).

3. In the Arduino sketch, set:

- Wi-Fi SSID / password
- MQTT host = your PC IP (e.g. `192.168.1.10`)

4. Flash the ESP32 and open Serial Monitor.

If telemetry is flowing, you should see records and (when `alert_code=1`) alerts in the dashboard.

## 6) Calibration checklist (do once)

- **ACS712 offset**: with motor OFF, read the sensor output average and store as `V_OFFSET`.
- **ACS712 sensitivity**: typical is ~100mV/A for the 20A variant, but modules vary.
- **Voltage divider scale**: verify with a multimeter and adjust the scale factor.

## 7) Notes / limitations

- The shipped ONNX model and feature engineering were trained for AC-like telemetry ranges (e.g. assumes 230V). With a DC motor, ML predictions may not be meaningful.
- For the prototype demo, rely on `alert_code` logic on the ESP32 to demonstrate end-to-end alerts.
