#include "net/MqttPublisher.h"

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

#include <cstring>

static WiFiClient g_wifiClient;
static PubSubClient g_mqtt(g_wifiClient);

static const char* mqttStateToString(int state) {
  switch (state) {
    case MQTT_CONNECTION_TIMEOUT:
      return "CONNECTION_TIMEOUT";
    case MQTT_CONNECTION_LOST:
      return "CONNECTION_LOST";
    case MQTT_CONNECT_FAILED:
      return "CONNECT_FAILED";
    case MQTT_DISCONNECTED:
      return "DISCONNECTED";
    case MQTT_CONNECTED:
      return "CONNECTED";
    case MQTT_CONNECT_BAD_PROTOCOL:
      return "BAD_PROTOCOL";
    case MQTT_CONNECT_BAD_CLIENT_ID:
      return "BAD_CLIENT_ID";
    case MQTT_CONNECT_UNAVAILABLE:
      return "UNAVAILABLE";
    case MQTT_CONNECT_BAD_CREDENTIALS:
      return "BAD_CREDENTIALS";
    case MQTT_CONNECT_UNAUTHORIZED:
      return "UNAUTHORIZED";
    default:
      return "UNKNOWN";
  }
}

static bool isDigit(char c) {
  return c >= '0' && c <= '9';
}

static uint16_t parsePortOrDefault(const char* s, uint16_t defaultPort) {
  if (s == nullptr || *s == '\0') return defaultPort;
  uint32_t port = 0;
  for (const char* p = s; *p; ++p) {
    if (!isDigit(*p)) return defaultPort;
    port = port * 10 + static_cast<uint32_t>(*p - '0');
    if (port > 65535) return defaultPort;
  }
  return static_cast<uint16_t>(port);
}

static void trimLeadingSpaces(const char*& s) {
  while (s && (*s == ' ' || *s == '\t' || *s == '\r' || *s == '\n')) {
    ++s;
  }
}

static void copyBounded(char* dst, size_t dstSize, const char* src, size_t srcLen) {
  if (dstSize == 0) return;
  const size_t n = (srcLen < (dstSize - 1)) ? srcLen : (dstSize - 1);
  if (n > 0) {
    memcpy(dst, src, n);
  }
  dst[n] = '\0';
}

void MqttPublisher::begin(const char* host, uint16_t port, const char* clientId) {
  host_ = host;
  port_ = port;
  clientId_ = clientId;
  g_mqtt.setServer(host_, port_);
}

void MqttPublisher::beginFromUrl(const char* mqttUrl, const char* clientIdBase) {
  const char* s = mqttUrl;
  if (s == nullptr) s = "";
  trimLeadingSpaces(s);

  // Strip scheme if present (e.g. mqtt://)
  const char* schemeSep = strstr(s, "://");
  if (schemeSep != nullptr) {
    s = schemeSep + 3;
  }

  // Take until '/' if present (ignore paths)
  const char* end = strchr(s, '/');
  if (end == nullptr) {
    end = s + strlen(s);
  }

  // Split host[:port]
  const char* colon = nullptr;
  for (const char* p = s; p < end; ++p) {
    if (*p == ':') colon = p;
  }

  const uint16_t defaultPort = 1883;
  uint16_t port = defaultPort;

  if (colon != nullptr) {
    copyBounded(hostBuf_, sizeof(hostBuf_), s, static_cast<size_t>(colon - s));
    port = parsePortOrDefault(colon + 1, defaultPort);
  } else {
    copyBounded(hostBuf_, sizeof(hostBuf_), s, static_cast<size_t>(end - s));
  }

  // Build a unique-ish client ID to avoid collisions.
  // If you set MQTT_CLIENT_ID="backend-ingestor", this will become "backend-ingestor-<mac>".
  uint64_t mac = 0;
#if defined(ESP32)
  mac = ESP.getEfuseMac();
#endif
  const uint32_t macLow = static_cast<uint32_t>(mac & 0xFFFFFFFFULL);

  const char* base = (clientIdBase && *clientIdBase) ? clientIdBase : "esp32";
  snprintf(clientIdBuf_, sizeof(clientIdBuf_), "%s-%08lx", base, static_cast<unsigned long>(macLow));

  host_ = hostBuf_;
  port_ = port;
  clientId_ = clientIdBuf_;
  g_mqtt.setServer(host_, port_);
}

void MqttPublisher::loop() {
  g_mqtt.loop();
}

void MqttPublisher::ensureConnected() {
  if (g_mqtt.connected()) {
    return;
  }

  Serial.print("MQTT connecting to ");
  Serial.print(host_ ? host_ : "(null)");
  Serial.print(':');
  Serial.print(port_);
  Serial.print(" as ");
  Serial.println(clientId_ ? clientId_ : "(null)");

  while (!g_mqtt.connected()) {
    const bool ok = g_mqtt.connect(clientId_);
    if (ok) {
      Serial.println("MQTT connected");
      break;
    }

    const int state = g_mqtt.state();
    Serial.print("MQTT connect failed, state=");
    Serial.print(state);
    Serial.print(" (");
    Serial.print(mqttStateToString(state));
    Serial.println(")");

    // Common cause: broker host not reachable from ESP32 (e.g., using Docker service name).
    delay(1000);
  }
}

bool MqttPublisher::publish(const char* topic, const char* payload) {
  return g_mqtt.publish(topic, payload);
}
