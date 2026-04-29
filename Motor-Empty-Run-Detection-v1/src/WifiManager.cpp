#include "net/WifiManager.h"

#include <Arduino.h>
#include <WiFi.h>

void WifiManager::begin(const char* ssid, const char* password) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
}

void WifiManager::ensureConnected() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  Serial.print("WiFi connected, IP: ");
  Serial.println(WiFi.localIP());
}

bool WifiManager::isConnected() const {
  return WiFi.status() == WL_CONNECTED;
}
