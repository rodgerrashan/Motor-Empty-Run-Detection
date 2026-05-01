#pragma once

#include <cstdint>

class MqttPublisher {
public:
  void begin(const char* host, uint16_t port, const char* clientId);

  // Accepts forms like:
  // - mqtt://192.168.1.10:1883
  // - 192.168.1.10:1883
  // - mosquitto:1883
  // - 192.168.1.10
  // NOTE: ESP32 must use a LAN-reachable host; Docker service names won't resolve on Wi-Fi.
  void beginFromUrl(const char* mqttUrl, const char* clientIdBase);

  // Call frequently from loop
  void loop();

  // Connect if needed (blocks until connected)
  void ensureConnected();

  bool publish(const char* topic, const char* payload);

private:
  const char* host_ = nullptr;
  uint16_t port_ = 1883;
  const char* clientId_ = nullptr;

  // Storage for parsed/constructed values (beginFromUrl)
  char hostBuf_[80] = {0};
  char clientIdBuf_[80] = {0};
};
