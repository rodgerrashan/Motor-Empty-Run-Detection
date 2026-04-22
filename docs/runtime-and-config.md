# Runtime & Configuration

## Docker Compose Stack

The full MVP is designed to start with:

```bash
docker compose up --build
```

Defined in `docker-compose.yml`:

- `mongodb` (MongoDB 7)
- `mosquitto` (Eclipse Mosquitto 2)
- `backend` (Node.js service)
- `frontend` (nginx serving Vite build)
- `sensor-publisher` (Python publisher container)

## Ports

From `docker-compose.yml` and repo docs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- Backend health: `http://localhost:8080/health`
- MongoDB: `localhost:27017`
- MQTT broker: `localhost:1883`

## Backend Environment Variables

Configured in `docker-compose.yml` and consumed by `backend/src/config.js`.

### HTTP

- `PORT` (default 8080)

### Mongo

- `MONGO_URI` / `MONGODB_URI` (default `mongodb://localhost:27017`)
- `MONGO_DB_NAME` (default `motor_monitor`)

Pool/timeouts (optional tuning):

- `MONGO_MAX_POOL_SIZE` (default 50)
- `MONGO_MIN_POOL_SIZE` (default 5)
- `MONGO_MAX_IDLE_MS` (default 300000)
- `MONGO_CONNECT_TIMEOUT_MS` (default 8000)
- `MONGO_SOCKET_TIMEOUT_MS` (default 30000)
- `MONGO_SERVER_SELECTION_TIMEOUT_MS` (default 5000)

### MQTT

- `MQTT_URL` (default `mqtt://localhost:1883`)
- `MQTT_TOPIC` (default `edge_ai/motor_efficiency`)
- `MQTT_CLIENT_ID` (default `backend-ingestor`)

### Model Artifacts

- `MODEL_PATH` (default `../mlModel/motor_fault_model.onnx`)
- `FEATURE_COLUMNS_PATH` (default `../mlModel/feature_columns.json`)

In Docker Compose, `./mlModel` is mounted read-only into `/app/mlModel` for the backend container.

### Retention (TTL Indexes)

- `TELEMETRY_TTL_SECONDS` (default 2592000 = 30 days)
- `ALERTS_TTL_SECONDS` (default 7776000 = 90 days)

### Evaluation (Rolling Window)

- `EVAL_WINDOW_SIZE` (default 120)
- `EVAL_EMIT_EVERY` (default 20)

## Sensor Publisher Environment Variables

Used in `sensors/mqtt_publisher.py` and configured in Docker Compose:

- `MQTT_BROKER` (default `localhost`)
- `MQTT_PORT` (default `1883`)
- `MQTT_TOPIC` (default `edge_ai/motor_efficiency`)
- `PUBLISH_INTERVAL_SECONDS` (default `2`)

## Runtime Notes

- The frontend bootstraps history via REST then listens for live messages on the backend WebSocket `/ws`.
- The backend creates TTL indexes at startup; the first run may take a moment to create indexes.
- Mosquitto is configured for anonymous access (MVP setting). In production you would typically enable authentication and TLS.
