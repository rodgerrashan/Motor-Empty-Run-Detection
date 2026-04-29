# Motor Empty Run Detection - Full Stack MVP

This repository now includes a runnable full-stack MVP:

- Sensor simulator + MQTT publisher
- Backend (Node.js + Express + MQTT subscriber + ONNX inference)
- MongoDB data store
- Live dashboard (React)
- Docker Compose stack (MongoDB + Mosquitto + Backend + Frontend + Sensor Publisher)

## 1) Start stack

```bash
docker compose up --build
```

Services:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- Backend health: http://localhost:8080/health
- MongoDB: localhost:27017
- MQTT broker: localhost:1883
- Sensor publisher: runs automatically and streams telemetry

## 2) Start sensor stream

By default, `sensor-publisher` starts automatically in Docker Compose.

If you want to run the sensor manually instead, stop that service first:

```bash
docker compose stop sensor-publisher
```

Then run locally:

In another terminal:

```bash
python sensors/mqtt_publisher.py
```

Optional env vars:

- `MQTT_BROKER` (default `localhost`)
- `MQTT_PORT` (default `1883`)
- `MQTT_TOPIC` (default `edge_ai/motor_efficiency`)
- `PUBLISH_INTERVAL_SECONDS` (default `2`)

## 3) Useful API endpoints

- `GET /api/telemetry/latest?limit=30`
- `GET /api/alerts/recent?limit=20`
- `GET /api/eval/latest`

## Notes

- Runtime feature engineering in backend matches the notebook formulas.
- ONNX model and feature column order are mounted from `mlModel/` into backend container.
- Evaluation is proxy/drift-first (rolling confidence + class distribution window).

## ESP32 prototype (DC motor)

If you want a hardware demo using an ESP32 + a small DC motor (no real pump), see:

- `docs/esp32-prototype.md`
