#pragma once

class WifiManager {
public:
  void begin(const char* ssid, const char* password);
  void ensureConnected();
  bool isConnected() const;
};
