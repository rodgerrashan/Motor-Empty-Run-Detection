#pragma once

#include <cstdint>

class MqttPublisher {
public:
  void begin(const char* host, uint16_t port, const char* clientId);

  // Call frequently from loop
  void loop();

  // Connect if needed (blocks until connected)
  void ensureConnected();

  bool publish(const char* topic, const char* payload);

private:
  const char* host_ = nullptr;
  uint16_t port_ = 1883;
  const char* clientId_ = nullptr;
};
