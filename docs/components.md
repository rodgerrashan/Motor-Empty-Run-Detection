# Components

This file describes the responsibilities of each major folder/service and how they relate.

## `sensors/` (Sensor-side simulation and publishing)

Primary goal: produce telemetry messages that look like motor instrumentation data.

- `sensors/motor.py`
  - Implements `MotorSimulator`.
  - Simulates four states: `NORMAL`, `EMPTY_RUN`, `STALLED`, `OFF`.
  - Adds noise and uses state-transition probabilities to mimic faults.

- `sensors/mqtt_publisher.py`
  - Creates an MQTT client and publishes telemetry every `PUBLISH_INTERVAL_SECONDS`.
  - Topic defaults to `edge_ai/motor_efficiency`.
  - The payload contains raw signals plus extra fields like `status`, `alert_code`, and a publisher-side `confidence`.

- `sensors/data_logger.py`
  - Optional dataset generation: write telemetry rows to `dataset/motor_dataset.csv`.

## `infra/` (Infrastructure configuration)

- `infra/mosquitto/mosquitto.conf`
  - Mosquitto config: listener on 1883, anonymous allowed.

## `backend/` (Ingestion, inference, storage, APIs)

Primary goal: turn a stream of telemetry into persisted records + alerts + live UI updates.

- `backend/src/index.js`
  - Backend entrypoint.
  - Connects MongoDB, loads ONNX model, starts MQTT subscriber, initializes WebSocket hub, serves HTTP.

- `backend/src/config.js`
  - Centralizes environment variables and defaults.

- `backend/src/mqtt/subscriber.js`
  - MQTT client connection + topic subscription.
  - On message: `JSON.parse` → `processTelemetry(payload)`.

- `backend/src/services/telemetryService.js`
  - Validates required fields.
  - Computes engineered features.
  - Runs inference.
  - Inserts `telemetry` rows.
  - Creates `alerts` when abnormal.
  - Produces periodic `model_eval` snapshots.

- `backend/src/ml/featureEngineering.js`
  - Runtime feature engineering.
  - Formulas are aligned to the training notebook.

- `backend/src/ml/onnxService.js`
  - Loads an ONNX model from disk and runs inference using `onnxruntime-node`.
  - Uses feature column order defined by `mlModel/feature_columns.json`.

- `backend/src/realtime/wsHub.js`
  - WebSocket server at `/ws`.
  - Broadcasts messages to connected clients.

- `backend/src/api/routes.js`
  - REST endpoints for health, latest telemetry, alerts, and latest evaluation snapshot.

- `backend/src/db/mongo.js`
  - Mongo client setup.
  - Creates indexes for TTL retention and query patterns.

## `mlModel/` (Model artifacts + training notebook)

Primary goal: keep the model artifacts the backend needs.

- `mlModel/model_train.ipynb`
  - Notebook describing how the model is trained from the dataset.
  - Produces an ONNX export for backend inference.

- `mlModel/motor_fault_model.onnx`
  - Trained classifier in ONNX format.

- `mlModel/feature_columns.json`
  - The exact column order expected by the model input.
  - Must match runtime feature engineering.

## `frontend/` (Live dashboard)

Primary goal: a single-page dashboard that combines history + live streaming.

- `frontend/src/App.jsx`
  - Bootstraps initial state via REST.
  - Subscribes to live updates via WebSocket.
  - Renders charts (gauges, trend lines, evaluation panel, alerts list).

- `frontend/Dockerfile`
  - Builds static assets with Vite.
  - Serves via nginx in the runtime container.
