# Architecture & Data Flow

## System Diagram (Runtime)

```mermaid
flowchart LR
  subgraph Sensors[Sensor Side]
    P[Python sensor publisher\n`sensors/mqtt_publisher.py`]
  end

  subgraph Broker[MQTT]
    M[Mosquitto broker\n1883]
  end

  subgraph Backend[Backend Service]
    S[MQTT subscriber\n`backend/src/mqtt/subscriber.js`]
    FE[Feature engineering\n`backend/src/ml/featureEngineering.js`]
    ONNX[ONNX inference\n`backend/src/ml/onnxService.js`]
    API[REST API\n`backend/src/api/routes.js`]
    WS[WebSocket hub (/ws)\n`backend/src/realtime/wsHub.js`]
  end

  subgraph DB[MongoDB]
    T[(telemetry)]
    A[(alerts)]
    E[(model_eval)]
  end

  subgraph UI[Frontend]
    F[React dashboard\n`frontend/src/App.jsx`]
  end

  P -- publish JSON --> M
  M -- subscribe topic --> S
  S --> FE --> ONNX

  ONNX -->|telemetry insert| T
  ONNX -->|alert insert (conditional)| A
  ONNX -->|eval snapshot insert (periodic)| E

  T --> API
  A --> API
  E --> API

  WS --> F
  API --> F

  Backend --- WS
  Backend --- API
```

## End-to-End Flow (What Happens Per Telemetry Event)

1. **Sensor publisher generates telemetry** (simulated signals) and publishes a JSON message to an MQTT topic.
2. **Mosquitto** receives the publish and makes the message available to subscribers.
3. **Backend MQTT subscriber** receives the message, parses JSON, and calls the telemetry processing pipeline.
4. **Backend feature engineering** derives runtime features from raw sensor values.
5. **ONNX inference** runs on the engineered feature vector and produces a predicted state.
6. **Persistence**:
   - a full telemetry record is inserted into MongoDB `telemetry`.
   - if abnormal (or sensor alert codes exist), an alert record is inserted into `alerts`.
   - periodically, a rolling-window evaluation snapshot is inserted into `model_eval`.
7. **Real-time updates** are pushed to the dashboard over WebSocket `/ws`:
   - `telemetry` events for every ingested message
   - `alert` events only when an alert is created
   - `model_eval` events when an evaluation snapshot is emitted

## Why Both REST and WebSocket?

- **REST** is used for initial bootstrap (get “latest N” history on page load).
- **WebSocket** is used for live streaming updates without polling.
