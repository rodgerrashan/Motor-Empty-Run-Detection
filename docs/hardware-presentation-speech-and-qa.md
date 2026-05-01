# Hardware Presentation (v1 + v2) — 3‑Minute Speech + Q&A Bank

## 3‑minute speech script (hardware focus)

Good [morning/afternoon]. For the hardware part of our *Motor Empty‑Run Detection* project, the goal was to build a low‑cost **edge sensor node** that can measure motor behavior in real time and publish telemetry to the rest of the system.

We built the main prototype in **Motor-Empty-Run-Detection-v1**, using an **ESP32 NodeMCU‑32S** as the controller. The design idea is simple: empty‑run is usually reflected as a **load change**, so we measure signals that change when the motor load changes—electrical load and mechanical vibration.

First, for **electrical sensing**, we used an **ACS712 20A current sensor** connected to the ESP32 ADC on **GPIO34**, and a **voltage divider** connected to **GPIO35** to read motor supply voltage. Using two analog channels lets us check “motor is actually powered” and also observe current patterns. A key design choice here is **calibration**: at startup, the firmware measures the ACS712 **zero‑current offset** while the motor is OFF, then it computes the current value relative to that offset. This makes readings more stable despite sensor drift and ADC variation.

Second, for **mechanical sensing**, we added an **MPU6050** on I2C (**GPIO21 SDA, GPIO22 SCL**) to estimate a demo‑level vibration value and read its internal temperature. The vibration estimator is intentionally lightweight—good enough to show that vibration rises when the motor runs, without requiring heavy DSP on the microcontroller.

For **actuation**, we included a relay driver module (SRD‑05VDC‑SL‑C style) controlled by a GPIO (**GPIO26** in v1). This gives us a path to cut the motor if empty‑run is detected, but in the current demo configuration we keep that “auto‑stop” disabled by default to avoid unexpected shutdowns during testing.

Communication‑wise, the ESP32 connects over Wi‑Fi and publishes a JSON payload via **MQTT** to the topic **`edge_ai/motor_efficiency`**, matching the backend’s required fields like motor id, rpm, vibration, current, temperature, and power factor. Since this prototype is a DC motor demo and we don’t have an RPM sensor in the parts list, we intentionally provide an **assumed RPM constant** just to satisfy the backend interface.

Before integrating everything into v1, we validated the risky parts using **Prototype/Motor-Run-Test-v2**: a minimal firmware that tests the **ADC measurements and relay wiring**. In that test, we calibrate current zero, read current and voltage repeatedly, and disconnect the motor for a short time when current crosses a threshold. We also used an **active‑low relay strategy with open‑drain output**, which is a hardware‑driven design choice to avoid 3.3V/5V logic issues and make relay OFF behavior reliable.

So, the approach is: validate sensing + switching safely in v2, then integrate sensing, MQTT telemetry, and empty‑run heuristics in v1, in a way that the rest of the system can consume immediately.

---

## Detailed Q&A bank (likely questions + strong answers)

### Architecture / approach

**Q1: What’s the hardware approach in one sentence?**  
A: An ESP32 edge node reads motor **current, voltage, and vibration**, then publishes MQTT telemetry and can optionally control a relay to protect the motor.

**Q2: Why measure current for empty‑run detection?**  
A: Empty‑run typically reduces mechanical load, so the motor draws **less current**. Current is a direct, inexpensive proxy for load.

**Q3: Why also measure voltage if current is already measured?**  
A: Voltage confirms the motor is actually powered and helps distinguish “motor OFF / supply missing” from “motor running at low load.” It’s also useful for debugging.

**Q4: Why include vibration (MPU6050) at all?**  
A: Vibration adds another independent signal: mechanical changes can show up in vibration even when electrical readings are noisy, and it improves the demo’s observability.

**Q5: Why MQTT for the hardware node?**  
A: MQTT is lightweight, works well on unreliable Wi‑Fi, and cleanly decouples the sensor node from the backend; it’s a standard for IoT telemetry.

---

### Component choices

**Q6: Why ESP32 NodeMCU‑32S?**  
A: It’s low‑cost, has built‑in Wi‑Fi, enough CPU for basic processing, and multiple ADC/I2C GPIOs suitable for sensors.

**Q7: Why ACS712 20A?**  
A: It’s readily available, easy to interface (analog), and adequate range for a small motor demo. It gives a continuous signal we can threshold or trend.

**Q8: Why a voltage divider instead of a dedicated voltage sensor module?**  
A: A divider is simple, cheap, and accurate enough if the resistor ratio is known; it’s also easy to compute back to the real motor voltage.

**Q9: Why MPU6050 specifically?**  
A: It’s common, low cost, and supports I2C; it provides acceleration data for a simple vibration estimate and internal temperature for a proxy reading.

**Q10: Why a relay module rather than driving a bare relay coil?**  
A: GPIO pins can’t supply coil current and inductive loads need protection. A relay module (or transistor + flyback diode) is the correct safe driver.

---

### Electrical safety / robustness

**Q11: What’s the biggest electrical risk in this design?**  
A: Feeding more than **3.3V** into an ESP32 ADC pin. If the ACS712 board is powered at 5V, its output can exceed 3.3V, so we must power it at 3.3V if possible or use a divider on Vout.

**Q12: How did you handle relay logic‑level mismatch (3.3V ESP32 vs 5V relay module)?**  
A: In the v2 test we used **open‑drain** behavior for active‑low modules: writing HIGH releases the line so the module’s pull‑up can reach 5V cleanly; writing LOW actively turns the relay ON.

**Q13: Why use COM+NC wiring in the v2 test?**  
A: It’s a “fail‑safe” behavior for demos: with relay OFF, the motor stays connected; only energizing the relay disconnects it. If the controller resets, it tends to return to relay OFF.

**Q14: How do you reduce noise from the motor affecting readings?**  
A: We average multiple ADC samples, calibrate offsets at startup, keep wiring short, use common ground carefully, and add suppression like a flyback diode across the motor if needed.

---

### Calibration / measurement details

**Q15: How do you calibrate the ACS712?**  
A: At boot, while the motor is OFF, we sample the ADC to compute the **zero‑current voltage** (offset). Then current is computed as $(V- V_{0})/sensitivity$.

**Q16: What sampling strategy do you use?**  
A: Both v1 and v2 take multiple ADC samples per reading (tens to hundreds), with small microsecond delays, then average to reduce noise.

**Q17: Is the current measurement RMS?**  
A: In v1 it computes an RMS‑style magnitude around the offset; in v2 it uses an averaged magnitude around the offset. For DC motor demo both are usable, but for AC you’d want true RMS synchronized to the mains.

**Q18: How do you compute voltage from the divider?**  
A: Read ADC voltage then multiply by the divider scale: $V_{motor}=V_{adc}\times\frac{R_{top}+R_{bottom}}{R_{bottom}}$.

---

### Firmware + system integration

**Q19: What does v2 prove that v1 doesn’t?**  
A: v2 is a minimal, controlled test that verifies **ADC readings and relay control/wiring** without Wi‑Fi, MQTT, or extra sensors—so we isolate hardware issues early.

**Q20: Why is `rpm` a constant in v1?**  
A: We didn’t include an RPM sensor in the hardware list for this prototype. The backend expects an `rpm` field, so we provide a constant purely for interface compatibility.

**Q21: Why is `power_factor` set to 1.0?**  
A: This demo uses a DC motor and doesn’t measure phase shift, so power factor isn’t meaningful here. We set it to 1.0 to satisfy the backend schema.

**Q22: How does the ESP32 talk to the backend stack running in Docker?**  
A: The ESP32 publishes to the MQTT broker using the **PC’s LAN IP**. The Docker service name `mosquitto` only works inside the Docker network, not from Wi‑Fi.

---

### Empty‑run detection logic (hardware perspective)

**Q23: What’s the empty‑run signal you rely on most?**  
A: A drop in current below a threshold while the motor is considered “running.” It’s the simplest and most reliable signal in this prototype.

**Q24: Why keep auto‑stop disabled by default in v1?**  
A: It reduces risk during debugging. False positives while tuning thresholds could cause annoying or unsafe stop/start behavior.

**Q25: What are the limitations of this prototype?**  
A: No real RPM sensor, vibration estimation is demo‑level, ADC readings depend on wiring/noise, and thresholds need tuning for each motor/load.

**Q26: What would you improve next for production?**  
A: Add an RPM sensor (Hall/encoder), proper isolation/conditioning for current/voltage, better vibration processing, and closed‑loop decisions validated with ground truth data.
