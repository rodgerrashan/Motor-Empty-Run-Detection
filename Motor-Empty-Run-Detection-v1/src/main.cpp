#include <Arduino.h>

#include "AppConfig.h"

#include "EdgeRandomForest.h"

#include "net/WifiManager.h"
#include "net/MqttPublisher.h"

#include "RelayController.h"

#include "sensors/Acs712Sensor.h"
#include "sensors/VoltageDividerSensor.h"
#include "sensors/Mpu6050Sensor.h"

#include "TelemetryPayload.h"

static WifiManager g_wifi;
static MqttPublisher g_mqtt;

static RelayController g_relay;
static bool g_motorOn = true;

static Acs712Sensor g_acs;
static VoltageDividerSensor g_vdiv;
static Mpu6050Sensor g_mpu;

static uint32_t g_lastPublishMs = 0;

static float nowSeconds() {
  // Backend accepts seconds or ms; we use seconds since boot.
  return millis() / 1000.0f;
}

static void updateMotorControl(bool emptyRun) {
  if (!AppConfig::RELAY_ENABLED) return;

  if (AppConfig::STOP_MOTOR_ON_EMPTY_RUN) {
    g_motorOn = !emptyRun;
  }

  g_relay.setOn(g_motorOn);
}

static bool predictEmptyRunRf(
    float rpm,
    float vibrationHz,
    float currentA,
    float temperatureC,
    float powerFactor,
    float* confidenceOut) {
  float features[EdgeRandomForest::kNumFeatures] = {0};
  features[0] = rpm;
  features[1] = vibrationHz;
  features[2] = currentA;
  features[3] = temperatureC;
  features[4] = powerFactor;
  features[5] = vibrationHz / (currentA + 0.1f);
  features[6] = currentA / 15.5f;
  features[7] = fabsf(vibrationHz - 60.2f);
  features[8] = temperatureC - 48.0f;
  features[9] = (currentA * 230.0f * powerFactor) / 1000.0f;
  features[10] = (currentA > 22.0f && rpm < 200.0f) ? 1.0f : 0.0f;

  float conf = 0.0f;
  const uint8_t pred = EdgeRandomForest::predict(features, &conf);
  if (confidenceOut) *confidenceOut = conf;
  return pred == 1;
}

static void publishOnce() {
  const float rpm = AppConfig::RPM_ASSUMED;
  const float currentA = g_acs.readRmsCurrentA(250, 200);
  const float motorV = g_vdiv.readVoltageV(20, 1);

  const float vibHz = g_mpu.estimateVibrationHz(500, 200);
  const float tempC = g_mpu.read().temp_c;

  float rfConfidence = 0.0f;
  const bool emptyRun = predictEmptyRunRf(
      rpm,
      vibHz,
      currentA,
      tempC,
      AppConfig::POWER_FACTOR_DC,
      &rfConfidence);
  const int alertCode = emptyRun ? 1 : 0;

  updateMotorControl(emptyRun);

  TelemetryPayload payload{};
  payload.motor_id = AppConfig::MOTOR_ID;
  payload.timestamp_s = nowSeconds();
  payload.rpm = rpm;
  payload.vibration_hz = vibHz;
  payload.current_amp = currentA;
  payload.temperature_c = tempC;
  payload.power_factor = AppConfig::POWER_FACTOR_DC;

  payload.status = emptyRun ? "EMPTY RUN DETECTED" : "HEALTHY";
  payload.state = emptyRun ? "EMPTY_RUN" : "NORMAL";
  payload.alert_code = alertCode;
  payload.motor_voltage_v = motorV;

  char json[512];
  if (!payload.toJson(json, sizeof(json))) {
    Serial.println("Telemetry JSON too large");
    return;
  }

  const bool ok = g_mqtt.publish(AppConfig::MQTT_TOPIC, json);
  Serial.print(ok ? "Published: " : "Publish failed: ");
  Serial.println(json);

  Serial.print("Edge RF prediction: ");
  Serial.print(emptyRun ? "EMPTY_RUN" : "NORMAL");
  Serial.print(" (confidence=");
  Serial.print(rfConfidence, 3);
  Serial.println(")");
}

void setup() {
  Serial.begin(115200);
  delay(300);

  // ADC setup
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Relay
  if (AppConfig::RELAY_ENABLED) {
    g_relay.begin(AppConfig::PIN_RELAY, AppConfig::RELAY_ACTIVE_LOW);
    g_relay.setOn(false); // keep OFF while booting
  }

  // Sensors
  g_acs.begin(AppConfig::PIN_ACS712, AppConfig::ACS_SENS_V_PER_A, AppConfig::ACS_VOUT_TO_ADC_SCALE);
  g_vdiv.begin(AppConfig::PIN_VDIV, AppConfig::VDIV_SCALE);
  g_mpu.begin(AppConfig::I2C_SDA, AppConfig::I2C_SCL, AppConfig::MPU6050_I2C_ADDR);

  // WiFi + MQTT
  g_wifi.begin(AppConfig::WIFI_SSID, AppConfig::WIFI_PASSWORD);
  g_wifi.ensureConnected();

  g_mqtt.beginFromUrl(AppConfig::MQTT_URL, AppConfig::MQTT_CLIENT_ID);
  g_mqtt.ensureConnected();

  // Calibrate ACS offset (motor should be OFF for best results)
  Serial.println("Calibrating ACS712 offset (ensure motor is OFF)...");
  g_acs.calibrateOffset();

  // Turn motor ON after init (optional)
  if (AppConfig::RELAY_ENABLED) {
    g_motorOn = true;
    g_relay.setOn(g_motorOn);
  }

  g_lastPublishMs = millis();
}

void loop() {
  g_wifi.ensureConnected();
  g_mqtt.ensureConnected();
  g_mqtt.loop();

  const uint32_t now = millis();
  if (now - g_lastPublishMs >= AppConfig::PUBLISH_EVERY_MS) {
    g_lastPublishMs = now;
    publishOnce();
  }
}