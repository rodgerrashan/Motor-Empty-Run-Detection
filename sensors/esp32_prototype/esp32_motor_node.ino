// ESP32 DC-motor telemetry node for this repo's MQTT ingestion pipeline.
// Publishes required fields:
//   motor_id, rpm, vibration_hz, current_amp, temperature_c, power_factor
// Topic must match backend env MQTT_TOPIC (default: edge_ai/motor_efficiency)
//
// Libraries (Arduino IDE -> Library Manager):
//   - PubSubClient (by Nick O'Leary)
//
// MPU6050 is accessed via raw I2C reads (no extra library required).

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>

// -------------------- User config --------------------

// Wi-Fi
static const char* WIFI_SSID = "YOUR_WIFI_SSID";
static const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// MQTT (use your PC/Laptop LAN IP running Mosquitto via docker compose)
static const char* MQTT_HOST = "192.168.1.10";
static const uint16_t MQTT_PORT = 1883;
static const char* MQTT_TOPIC = "edge_ai/motor_efficiency";

// Identity
static const char* MOTOR_ID = "ESP32-DC-01";

// Publish interval (ms)
static const uint32_t PUBLISH_EVERY_MS = 2000;

// Pins (ESP32 DevKit)
static const int PIN_ACS712 = 34;       // ADC input for ACS712 Vout (must be <= 3.3V)
static const int PIN_VDIV = 35;         // ADC input for voltage divider (must be <= 3.3V)

// Relay control (SRD-05VDC-SL-C via relay MODULE or transistor driver)
// Relay is for ON/OFF only (do not PWM a relay).
static const bool RELAY_ENABLED = true;
static const int PIN_RELAY = 26;
static const bool RELAY_ACTIVE_LOW = true; // many relay modules are active-low
static const bool STOP_MOTOR_ON_EMPTY_RUN = false; // set true to cut motor power when empty-run is detected

// Optional: motor PWM (for demo RPM estimation). If you don't control the motor with ESP32,
// set PWM_ENABLED=false and RPM will be a fixed constant.
static const bool PWM_ENABLED = false;
static const int PIN_PWM = 25;
static const int PWM_CHANNEL = 0;
static const int PWM_FREQ_HZ = 20000;
static const int PWM_RES_BITS = 10;
static const float RPM_AT_FULL_DUTY = 6000.0f;
static const float RPM_WHEN_NOT_CONTROLLED = 3000.0f;

// ACS712 calibration
// 20A modules are often ~100mV/A (0.1 V/A) *at sensor output*.
// If you added a divider between ACS712 Vout and ESP32 ADC, you must include its scale.
static const float ACS_SENS_V_PER_A = 0.100f; // adjust after calibration
static const float ACS_VOUT_TO_ADC_SCALE = 1.0f; // 1.0 if direct; >1 if you divided down (e.g. divider 0.66 => scale ~1/0.66 = 1.515)

// Voltage divider calibration: Vmotor = Vadc * VDIV_SCALE
// Example: if divider is (Rtop + Rbottom) / Rbottom
static const float VDIV_SCALE = 4.0f; // adjust to your resistor values

// Empty-run heuristic (demo): below this current while RPM is high
static const float EMPTY_RUN_CURRENT_A = 0.25f;

// MPU6050
static const uint8_t MPU_ADDR = 0x68;

// -------------------- Internals --------------------

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

static float acsOffsetV = 1.65f; // learned at startup
static uint32_t lastPublishMs = 0;
static uint16_t pwmDuty = 0; // 0..(2^PWM_RES_BITS - 1)
static bool motorEnabled = true;

// -------------------- Helpers --------------------

static float adcToVolts(uint16_t raw) {
  // Default Arduino-ESP32 analogRead is 12-bit (0..4095) unless changed.
  return (raw / 4095.0f) * 3.3f;
}

static void i2cWriteByte(uint8_t addr, uint8_t reg, uint8_t value) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission(true);
}

static void i2cReadBytes(uint8_t addr, uint8_t reg, uint8_t* buf, size_t len) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom((int)addr, (int)len, (int)true);
  for (size_t i = 0; i < len && Wire.available(); i++) {
    buf[i] = (uint8_t)Wire.read();
  }
}

static void mpuInit() {
  // Wake up device
  i2cWriteByte(MPU_ADDR, 0x6B, 0x00);
  // Accel config: +/- 2g (default)
  i2cWriteByte(MPU_ADDR, 0x1C, 0x00);
  // Gyro config: +/- 250 deg/s (default)
  i2cWriteByte(MPU_ADDR, 0x1B, 0x00);
}

static void mpuRead(float& ax_g, float& ay_g, float& az_g, float& temp_c) {
  uint8_t data[14] = {0};
  i2cReadBytes(MPU_ADDR, 0x3B, data, 14);

  int16_t ax = (int16_t)((data[0] << 8) | data[1]);
  int16_t ay = (int16_t)((data[2] << 8) | data[3]);
  int16_t az = (int16_t)((data[4] << 8) | data[5]);
  int16_t t = (int16_t)((data[6] << 8) | data[7]);

  // For +/-2g: 16384 LSB/g
  ax_g = ax / 16384.0f;
  ay_g = ay / 16384.0f;
  az_g = az / 16384.0f;

  // MPU6050 temperature formula (datasheet): Temp(C) = t/340 + 36.53
  temp_c = (t / 340.0f) + 36.53f;
}

static float readCurrentRmsA(uint16_t samples, uint16_t sampleDelayUs) {
  // Compute RMS of centered voltage, convert using sensitivity.
  // Works as a stable “magnitude” even with PWM ripple.
  double sumSq = 0.0;
  for (uint16_t i = 0; i < samples; i++) {
    uint16_t raw = analogRead(PIN_ACS712);
    float vAdc = adcToVolts(raw);
    float vAtSensor = vAdc * ACS_VOUT_TO_ADC_SCALE;
    float centered = vAtSensor - acsOffsetV;
    sumSq += (double)centered * (double)centered;
    delayMicroseconds(sampleDelayUs);
  }

  float vRms = sqrt(sumSq / samples);
  float iRms = vRms / ACS_SENS_V_PER_A;
  if (!isfinite(iRms) || iRms < 0) return 0.0f;
  return iRms;
}

static float readMotorVoltageV(uint16_t samples) {
  // Averaged ADC reading of divider output.
  double sum = 0.0;
  for (uint16_t i = 0; i < samples; i++) {
    uint16_t raw = analogRead(PIN_VDIV);
    sum += raw;
    delay(1);
  }
  float avgRaw = (float)(sum / samples);
  float vAdc = adcToVolts((uint16_t)avgRaw);
  return vAdc * VDIV_SCALE;
}

static float estimateRpm() {
  if (!PWM_ENABLED) {
    return RPM_WHEN_NOT_CONTROLLED;
  }
  const float maxDuty = (float)((1 << PWM_RES_BITS) - 1);
  float duty01 = pwmDuty / maxDuty;
  float rpm = duty01 * RPM_AT_FULL_DUTY;
  if (rpm < 0) rpm = 0;
  return rpm;
}

static float estimateVibrationHz(float seconds) {
  // Very lightweight “vibration frequency-ish” estimate:
  // - read accel magnitude at ~200 Hz
  // - high-pass filter (IIR) and count sign changes
  const uint16_t fs = 200;
  const uint16_t n = (uint16_t)(fs * seconds);

  float prevMag = 0.0f;
  float hp = 0.0f;
  const float alpha = 0.95f;

  int signPrev = 0;
  uint32_t signChanges = 0;

  for (uint16_t i = 0; i < n; i++) {
    float ax, ay, az, tempC;
    mpuRead(ax, ay, az, tempC);

    float mag = sqrtf(ax * ax + ay * ay + az * az);

    // simple high-pass
    hp = alpha * (hp + mag - prevMag);
    prevMag = mag;

    int signNow = (hp > 0.0f) ? 1 : (hp < 0.0f ? -1 : 0);
    if (signPrev != 0 && signNow != 0 && signNow != signPrev) {
      signChanges++;
    }
    if (signNow != 0) signPrev = signNow;

    delay(1000 / fs);
  }

  // Each full cycle has ~2 sign changes.
  float hz = (signChanges / 2.0f) / seconds;
  if (!isfinite(hz) || hz < 0) hz = 0;
  if (hz > 200) hz = 200;
  return hz;
}

static void wifiConnect() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected, IP: ");
  Serial.println(WiFi.localIP());
}

static void mqttConnect() {
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);

  Serial.print("MQTT connecting");
  while (!mqttClient.connected()) {
    String clientId = String("esp32-") + MOTOR_ID;
    if (mqttClient.connect(clientId.c_str())) {
      break;
    }
    Serial.print(".");
    delay(1000);
  }
  Serial.println();
  Serial.println("MQTT connected");
}

static void calibrateAcsOffset() {
  // Assume motor is OFF and current is ~0A during this.
  const uint16_t n = 400;
  double sum = 0.0;
  for (uint16_t i = 0; i < n; i++) {
    uint16_t raw = analogRead(PIN_ACS712);
    float vAdc = adcToVolts(raw);
    float vAtSensor = vAdc * ACS_VOUT_TO_ADC_SCALE;
    sum += vAtSensor;
    delay(5);
  }
  acsOffsetV = (float)(sum / n);
  Serial.print("ACS712 offset V = ");
  Serial.println(acsOffsetV, 4);
}

static void publishTelemetry() {
  // Current RMS
  float currentA = readCurrentRmsA(250, 200); // ~50ms window @ 5kHz-ish

  // Motor voltage (optional; not required by backend)
  float motorV = readMotorVoltageV(20);

  // MPU
  float ax, ay, az, tempC;
  mpuRead(ax, ay, az, tempC);
  float vibHz = estimateVibrationHz(0.5f);

  // Demo RPM estimate
  float rpm = estimateRpm();

  // For DC demo: use 1.0
  float powerFactor = 1.0f;

  // Demo empty-run logic: low current while spinning
  bool emptyRun = (rpm > 500.0f) && (currentA < EMPTY_RUN_CURRENT_A);
  int alertCode = emptyRun ? 1 : 0;
  const char* status = emptyRun ? "EMPTY RUN DETECTED" : "HEALTHY";
  const char* state = emptyRun ? "EMPTY_RUN" : "NORMAL";

  if (RELAY_ENABLED && STOP_MOTOR_ON_EMPTY_RUN) {
    motorEnabled = !emptyRun;
  }

  // Timestamp in seconds (matches Python publisher style)
  float ts = (float)time(nullptr);
  if (ts < 100000.0f) {
    // If time isn't set, use millis-based seconds (backend will accept)
    ts = millis() / 1000.0f;
  }

  char payload[512];
  snprintf(
    payload,
    sizeof(payload),
    "{\"timestamp\":%.3f,\"motor_id\":\"%s\",\"rpm\":%.2f,\"vibration_hz\":%.2f,\"current_amp\":%.3f,\"temperature_c\":%.2f,\"power_factor\":%.3f,\"status\":\"%s\",\"state\":\"%s\",\"alert_code\":%d,\"motor_voltage_v\":%.2f}",
    ts,
    MOTOR_ID,
    rpm,
    vibHz,
    currentA,
    tempC,
    powerFactor,
    status,
    state,
    alertCode,
    motorV
  );

  bool ok = mqttClient.publish(MQTT_TOPIC, payload);

  Serial.print(ok ? "Published: " : "Publish failed: ");
  Serial.println(payload);
}

static void setRelay(bool on) {
  if (!RELAY_ENABLED) return;
  // Convert logical ON/OFF to the electrical level the module expects.
  // active-low: LOW=ON, HIGH=OFF
  bool pinLevel = RELAY_ACTIVE_LOW ? !on : on;
  digitalWrite(PIN_RELAY, pinLevel ? HIGH : LOW);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  // ADC setup
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db); // widest input range

  // I2C
  Wire.begin(21, 22);
  mpuInit();

  if (RELAY_ENABLED) {
    pinMode(PIN_RELAY, OUTPUT);
    // default OFF during boot for safety
    setRelay(false);
  }

  if (PWM_ENABLED) {
    ledcSetup(PWM_CHANNEL, PWM_FREQ_HZ, PWM_RES_BITS);
    ledcAttachPin(PIN_PWM, PWM_CHANNEL);
    pwmDuty = (1 << (PWM_RES_BITS - 1));
    ledcWrite(PWM_CHANNEL, pwmDuty);
  }

  wifiConnect();
  mqttConnect();

  calibrateAcsOffset();

  // Turn motor ON after startup if desired
  setRelay(motorEnabled);

  lastPublishMs = millis();
}

void loop() {
  if (!mqttClient.connected()) {
    mqttConnect();
  }
  mqttClient.loop();

  uint32_t now = millis();
  if (now - lastPublishMs >= PUBLISH_EVERY_MS) {
    lastPublishMs = now;

    // Keep relay state updated
    setRelay(motorEnabled);

    publishTelemetry();
  }
}
