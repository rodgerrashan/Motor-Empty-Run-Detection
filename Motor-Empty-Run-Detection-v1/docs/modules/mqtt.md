# MqttPublisher module

Files:

- `include/net/MqttPublisher.h`
- `src/MqttPublisher.cpp`

## Purpose

- Wraps PubSubClient MQTT connect + publish.

## Key API

- `begin(host, port, clientId)`
- `ensureConnected()`
- `loop()`
- `publish(topic, payload)`

## Notes

- This project publishes only (no subscribe).
- Broker host should be your PC/Laptop LAN IP (not `localhost`).
