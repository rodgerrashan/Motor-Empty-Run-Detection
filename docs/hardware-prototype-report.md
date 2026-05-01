# Hardware Prototype Report (ESP32 Node) — How It Works + Design Choices

Date: 2026-05-01  
Branch context: `dev/prototype`

This document is **hardware-focused**: it explains *what the physical prototype is*, *how it works end-to-end*, and *why specific design choices were made*. It intentionally does **not** walk through code line-by-line.

It is based on:

- Main hardware prototype project: `Motor-Empty-Run-Detection-v1/`
- Test run project used to validate measurements/relay behavior: `Prototype/Motor-Run-Test-v2/`

---

## 1) What the hardware prototype is

The hardware prototype is an **ESP32-based sensor/actuator node** that reads a small set of low-cost sensors attached to a motor and publishes telemetry over **MQTT**.

In the demo, a **DC motor** is used as a stand-in for a pump motor. The goal is not to perfectly replicate an industrial pump, but to reliably demonstrate:

- live measurement acquisition,
- networked telemetry publishing,
- and the ability to raise “empty-run”-style alerts (no-load vs load).

---

## 2) Hardware building blocks (and why they were chosen)

### Controller: ESP32 (NodeMCU-32S)

**Why ESP32:**

- Integrated Wi‑Fi enables a direct “sensor-to-MQTT” path without extra gateways.
- Has multiple ADC inputs for analog sensors (ACS712 + divider).
- Supports I2C for MPU6050.
- Cheap, available, and well-supported by Arduino + PlatformIO.

### Current sensing: ACS712 (20A)

**Role:** estimate motor load via current draw.

**Why current matters for empty-run:**

- The simplest prototype proxy for “load” is *motor current*.
- Empty-run/no-load typically produces **lower current** than loaded operation.

**Design choice:** calibration at startup

- ACS712 output has a mid-supply “zero” point that drifts; we do a **zero-offset calibration** at boot.
- Reason: without offset compensation, small-current conditions (the ones we care about for empty-run) are noisy and can be misclassified.

### Voltage measurement: resistor divider to ADC

**Role:** observe motor supply voltage and detect whether the motor is powered.

**Why keep voltage even if backend doesn’t require it:**

- Voltage is a useful *debug/sanity* signal:
  - confirms the motor supply is present,
  - helps diagnose wiring/power issues,
  - can support basic “motor ON/OFF” logic.

### Vibration and temperature proxy: MPU6050 (I2C)

**Role:** provide a rough vibration signal and a temperature reading.

**Why MPU6050:**

- Readily available, integrates well over I2C.
- Provides acceleration magnitude changes when the motor runs.
- Has an internal temperature sensor that is “good enough” as a demo proxy.

**Design choice:** lightweight vibration estimate

- Instead of FFT (heavy for a microcontroller), the prototype uses a **simple oscillation-rate estimate** over a short window.
- Reason: the dashboard/feature engineering only needs a consistent trend-like signal for demos, not lab-grade frequency analysis.

### Actuation: relay (SRD-05VDC-SL-C) / relay module

**Role:** provide motor **ON/OFF** control.

**Design constraints and reasoning:**

- A relay is suitable for **ON/OFF**, not speed control.
- Many relay modules are **active-low**; the design explicitly supports that to reduce wiring mistakes.
- Safety-first behavior: default motor OFF during boot; optional logic can cut motor power when empty-run is detected.

---

## 3) Electrical / wiring design choices (safety + practicality)

### 3.1 ADC voltage limits (critical)

ESP32 ADC pins must not exceed **3.3V**.

**Consequences:**

- If an ACS712 board is powered from 5V, its analog output can exceed 3.3V.
- Voltage divider outputs must be sized to keep ADC input within range.

**Why we call this out:**

- Exceeding ADC limits can damage the ESP32.
- Many beginner prototypes fail here; explicit scaling and calibration avoids that.

### 3.2 Common ground

All parts must share a common ground reference:

- ESP32 GND
- sensor grounds
- motor supply ground
- relay module ground

**Reason:** analog measurement and relay control become unreliable without a shared reference.

### 3.3 Flyback protection

- Motor and relay switching create inductive spikes.

**Design choice:** ensure flyback diode / suppression exists

- Either use a driver/module that includes suppression or add a diode across the motor terminals.
- Reason: improves reliability and reduces resets/noise-related measurement corruption.

---

## 4) Telemetry contract (what the node publishes and why)

The hardware node publishes MQTT telemetry designed to match the backend’s required fields.

### 4.1 Required fields (must exist)

The backend validates these exist per message:

- `motor_id`
- `rpm`
- `vibration_hz`
- `current_amp`
- `temperature_c`
- `power_factor`

**Reasoning:**

- The backend pipeline (feature engineering + model input vector) depends on these fields.
- Keeping a stable minimal schema lets us swap telemetry sources (Python simulator vs ESP32) without changes downstream.

### 4.2 Optional fields (useful for prototypes)

The node may also publish:

- `status` (operator-friendly string)
- `state` (node-side classification label)
- `alert_code` (explicit alert trigger)
- `motor_voltage_v` (debugging)

**Why include optional fields:**

- They make demos explainable (“why did it alert?”).
- They provide a deterministic alert path even if ML behavior is not yet tuned for the prototype’s sensor distribution.

### 4.3 Time base

Telemetry includes `timestamp` in seconds where possible.

**Reasoning:**

- Matches common embedded style and the Python simulator.
- Backend supports seconds or milliseconds, so the node can still function if it can’t set accurate epoch time.

---

## 5) How empty-run is simulated in hardware (the core demo)

### 5.1 Physical interpretation

With a DC motor, “empty-run” is simulated as:

- **Loaded condition** (represents normal pumping): mechanical load present → higher current
- **No-load condition** (represents empty-run): load removed → lower current

### 5.2 Detection heuristic (why we used it)

The node can classify empty-run using a simple rule:

- if motor is considered spinning (RPM above a minimum) AND measured current falls below a threshold → mark as empty-run

**Why this heuristic exists even in an ML system:**

- It provides a **deterministic, explainable demo**.
- It acts as a safety hook (optional motor cut-off) during experiments.
- It decouples early hardware bring-up from “perfect model behavior”.

### 5.3 Optional actuator response

The design includes an option to turn the motor OFF when empty-run is detected.

**Reasoning:**

- Demonstrates a closed-loop “detect → respond” industrial pattern.
- In a real system, this protects equipment from damage.

---

## 6) Measurement approach (design tradeoffs)

### 6.1 Current measurement: stability vs simplicity

Two approaches exist across the two prototype iterations:

- **Main prototype (v1)** uses a magnitude-like measurement approach designed to be stable in noisy environments and better capture “load”.
- **Test run (v2)** uses an averaged/absolute approach for quick validation and threshold tuning.

**Reasoning:**

- Early on, we need a reliable number to confirm wiring and sensor behavior quickly (v2).
- For a more robust node, we want a measurement that is less sensitive to offset drift and noise (v1).

### 6.2 RPM and power factor in a DC prototype

The backend requires `rpm` and `power_factor`.

**Design choice:** provide reasonable placeholders

- Without an RPM sensor, the node uses a constant assumed RPM (or an estimate if PWM is used).
- For DC, `power_factor` is set to 1.0.

**Reasoning:**

- Preserves schema compatibility so the backend/frontend stay unchanged.
- Keeps the demo focused on the signals we can actually measure (current + vibration trend).

### 6.3 Sampling windows

The node reads multiple ADC samples per measurement.

**Reasoning:**

- Oversampling + averaging reduces ADC noise.
- The publish period is kept moderate (e.g., ~2s) to balance network traffic and UI smoothness.

---

## 7) Networking design (why MQTT and how it is used)

### 7.1 MQTT publish-only node

The ESP32 prototype is a **publisher**:

- It publishes telemetry to `edge_ai/motor_efficiency`.
- It does not subscribe to commands (in this prototype).

**Reasoning:**

- Minimizes complexity and failure modes.
- Avoids needing device-side command handling before the sensing pipeline is validated.

### 7.2 Broker placement

During demos, the broker runs on a laptop/PC via Docker Compose.

**Reasoning:**

- Fast to deploy, reproducible setup.
- Works well for lab testing on a LAN.

---

## 8) Test run vs main prototype (what each was used for)

### 8.1 Main prototype: `Motor-Empty-Run-Detection-v1/`

Primary purpose:

- Full hardware node behavior: read sensors + compute telemetry + publish MQTT in the expected schema.
- Includes the “empty-run” demo heuristic and optional relay control.
- Designed to integrate directly with the main stack (backend + DB + dashboard).

### 8.2 Test run: `Prototype/Motor-Run-Test-v2/`

Primary purpose:

- Validate **ADC wiring**, **sensor calibration**, and **relay behavior** quickly.
- Measure voltage/current continuously and use a latch/threshold approach for relay behavior.
- Acts as a “bring-up and sanity check” project before running the full telemetry pipeline.

**Reasoning:**

- Hardware development benefits from a simpler test harness to isolate electrical/sensor issues.
- Once readings are stable and thresholds make sense, the full telemetry publisher can be used.

---

## 9) Known limitations (prototype stage)

- The prototype sensor set is minimal and tuned for demonstration rather than production-grade diagnostics.
- A DC motor demo does not perfectly represent an AC pump motor’s electrical characteristics.
- The node’s `rpm` and `power_factor` are placeholders unless additional sensing is added.

---

## 10) What we would improve next (hardware-focused)

- Add a real RPM sensor (hall/encoder) for accurate `rpm`.
- Improve vibration measurement with a better estimator (or send raw acceleration to backend for richer processing).
- Improve electrical robustness: dedicated motor driver, better filtering, proper enclosure/shielding.
- Add secure MQTT (auth/TLS) for any non-lab deployment.
