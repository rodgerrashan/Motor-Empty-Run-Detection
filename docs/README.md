# Docs: Motor Empty Run Detection (MVP)

This folder contains a detailed, code-aligned description of the repository architecture.

## Contents

- [Overview](./overview.md) — what the system is and why it exists
- [Architecture & Data Flow](./architecture.md) — end-to-end flow (MQTT → inference → DB → dashboard)
- [Components](./components.md) — responsibilities of each folder/service
- [APIs & Data Model](./api-and-data.md) — REST endpoints, WebSocket messages, MongoDB collections
- [Runtime & Configuration](./runtime-and-config.md) — Docker Compose, ports, key environment variables
- [Prototype Simulation Report](./prototype-simulation-report.md) — what we built to simulate the prototype (Python + ESP32) and why
- [Hardware Prototype Report](./hardware-prototype-report.md) — hardware-only: how the ESP32 prototype works + design choices/reasoning
