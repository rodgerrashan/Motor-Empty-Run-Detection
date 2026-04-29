#include <Arduino.h>

#include "AppConfig.h"

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

static bool isEmptyRun(float rpm, float currentA) {
  return (rpm >= AppConfig::EMPTY_RUN_RPM_MIN) && (currentA < AppConfig::EMPTY_RUN_CURRENT_A);
}

static void publishOnce() {
  const float rpm = AppConfig::RPM_ASSUMED;
  const float currentA = g_acs.readRmsCurrentA(250, 200);
  const float motorV = g_vdiv.readVoltageV(20, 1);

  const float vibHz = g_mpu.estimateVibrationHz(500, 200);
  const float tempC = g_mpu.read().temp_c;

  const bool emptyRun = isEmptyRun(rpm, currentA);
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

  g_mqtt.begin(AppConfig::MQTT_HOST, AppConfig::MQTT_PORT, AppConfig::MQTT_CLIENT_ID);
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