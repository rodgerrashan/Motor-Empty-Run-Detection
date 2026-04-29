#include "net/MqttPublisher.h"

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

static WiFiClient g_wifiClient;
static PubSubClient g_mqtt(g_wifiClient);

void MqttPublisher::begin(const char* host, uint16_t port, const char* clientId) {
  host_ = host;
  port_ = port;
  clientId_ = clientId;
  g_mqtt.setServer(host_, port_);
}

void MqttPublisher::loop() {
  g_mqtt.loop();
}

void MqttPublisher::ensureConnected() {
  if (g_mqtt.connected()) {
    return;
  }

  Serial.print("MQTT connecting");
  while (!g_mqtt.connected()) {
    if (g_mqtt.connect(clientId_)) {
      break;
    }
    Serial.print('.');
    delay(1000);
  }
  Serial.println();
  Serial.println("MQTT connected");
}

bool MqttPublisher::publish(const char* topic, const char* payload) {
  return g_mqtt.publish(topic, payload);
}
