# APIs & Data Model

## Backend REST API

Implemented in `backend/src/api/routes.js`.

- `GET /health`
  - Simple liveness response.

- `GET /api/telemetry/latest?limit=30&motorId=MTR-001`
  - Returns latest telemetry rows.
  - Sort: `event_time` descending.
  - Query supports optional motor filter: `motor_id`.

- `GET /api/alerts/recent?limit=20`
  - Returns latest alerts.
  - Sort: `created_at` descending.

- `GET /api/eval/latest`
  - Returns the most recent evaluation snapshot.

## WebSocket Messages

Implemented in `backend/src/realtime/wsHub.js`, used by `frontend/src/App.jsx`.

WebSocket endpoint:

- `ws://<backend-host>:8080/ws`

Message envelope:

```json
{
  "type": "telemetry" | "alert" | "model_eval" | "connected",
  "payload": { },
  "ts": 1710000000000
}
```

Where:

- `telemetry` payload is the full telemetry document inserted into MongoDB.
- `alert` payload is the alert document inserted into MongoDB.
- `model_eval` payload is the evaluation snapshot inserted into MongoDB.

## MongoDB Collections

Mongo connection and index creation live in `backend/src/db/mongo.js`.

### `telemetry`

A document per ingested event. Key fields:

- `motor_id`: string
- `event_time`: Date (derived from payload timestamp)
- `raw`: numeric raw telemetry signals (`rpm`, `vibration_hz`, `current_amp`, `temperature_c`, `power_factor`)
- `engineered`: runtime features (see “Feature Engineering” section)
- `predicted_state`: model output label
- `confidence`, `probabilities`: currently stored but backend inference returns `null` for these
- `source_state`, `source_status`: optional fields from the publisher
- `alert_code`: numeric, forwarded from payload when present
- `ingest_time`: Date

Indexes:

- `event_time` descending (query performance)
- TTL index on `event_time` (telemetry retention)
- compound index: `motor_id`, `event_time`

### `alerts`

Only created when:

- predicted state is abnormal (`EMPTY_RUN`, `STALLED`, `OFF`), OR
- payload has `alert_code > 0`

Fields include:

- `motor_id`, `created_at`, `event_time`
- `predicted_state`, `confidence`, `source_status`, `alert_code`

Indexes:

- `created_at` descending
- TTL index on `created_at`
- compound index: `motor_id`, `created_at`

### `model_eval`

Periodic rolling-window summary from `backend/src/services/evaluationService.js`:

- `metric_type`: currently `proxy_drift`
- `window_size`: number
- `confidence_mean`: number or null
- `confidence_std`: number or null
- `class_distribution`: map of label → ratio
- `created_at`: Date

### `model_registry`

An index exists for `model_version` uniqueness, but the current MVP does not write registry records.

## Feature Engineering

Implemented in `backend/src/ml/featureEngineering.js` and aligned with the training notebook.

Engineered fields:

- `vib_per_amp = vibration_hz / (current_amp + 0.1)`
- `current_ratio = current_amp / 15.5`
- `vibration_dev = |vibration_hz - 60.2|`
- `temp_rise = temperature_c - 48.0`
- `power_kw = (current_amp * 230 * power_factor) / 1000`
- `high_current_low_rpm = (current_amp > 22 && rpm < 200) ? 1 : 0`

The model input vector order is defined by `mlModel/feature_columns.json`.
