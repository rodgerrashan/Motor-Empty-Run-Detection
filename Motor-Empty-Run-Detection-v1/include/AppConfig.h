#pragma once

#include <cstdint>

namespace AppConfig {

// ---------------- Wi-Fi ----------------
static constexpr const char* WIFI_SSID = "Senz Cloud";
static constexpr const char *WIFI_PASSWORD = "GS20010423";

// ---------------- MQTT ----------------
// IMPORTANT: `mosquitto` is the Docker Compose service name; it resolves only *inside* the
// Docker network (backend container, sensor-publisher container, etc.). Your ESP32 is on
// Wi-Fi, so it must connect to the *LAN IP / hostname* of the machine running Mosquitto.
// Example: "mqtt://192.168.1.10:1883"
static constexpr const char* MQTT_URL = "mqtt://192.168.1.10:1883";

// Backwards-compatible host/port (used if you call begin(host, port, ...)).
static constexpr const char* MQTT_HOST = "192.168.1.10";
static constexpr uint16_t MQTT_PORT = 1883;
static constexpr const char* MQTT_TOPIC = "edge_ai/motor_efficiency";
static constexpr const char* MQTT_CLIENT_ID = "esp32-motor-node";

// ---------------- Identity ----------------
static constexpr const char* MOTOR_ID = "ESP32-DC-01";

// ---------------- Timing ----------------
static constexpr uint32_t PUBLISH_EVERY_MS = 2000;

// ---------------- Pins ----------------
static constexpr int PIN_ACS712 = 34; // ADC
static constexpr int PIN_VDIV = 35;   // ADC

static constexpr int I2C_SDA = 21;
static constexpr int I2C_SCL = 22;

static constexpr bool RELAY_ENABLED = true;
static constexpr int PIN_RELAY = 26;
static constexpr bool RELAY_ACTIVE_LOW = true;

// If true, the firmware will cut motor power when empty-run is detected.
static constexpr bool STOP_MOTOR_ON_EMPTY_RUN = false;

// ---------------- DC demo assumptions ----------------
// You do not have an RPM sensor in the discussed parts list.
// Provide a constant for the backend-required `rpm` field.
static constexpr float RPM_ASSUMED = 3000.0f;

// Power factor is required by backend. For DC prototype, use 1.0.
static constexpr float POWER_FACTOR_DC = 1.0f;

// Empty-run heuristic (demo): current below this while rpm is high.
static constexpr float EMPTY_RUN_CURRENT_A = 0.25f;
static constexpr float EMPTY_RUN_RPM_MIN = 500.0f;

// ---------------- ADC calibration ----------------
// ACS712 typical sensitivity for the 20A part is about 0.100 V/A, but modules vary.
static constexpr float ACS_SENS_V_PER_A = 0.100f;

// If ACS712 Vout is divided down before ESP32 ADC, set scale > 1.
// Example: divider ratio 0.66 (5V->3.3V) => scale ~ 1/0.66 = 1.515
static constexpr float ACS_VOUT_TO_ADC_SCALE = 1.0f;

// Voltage divider: Vmotor = Vadc * VDIV_SCALE
static constexpr float VDIV_SCALE = 4.0f;

// ---------------- MPU6050 ----------------
static constexpr uint8_t MPU6050_I2C_ADDR = 0x68;

} // namespace AppConfig
