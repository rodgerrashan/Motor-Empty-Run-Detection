# Overview

## Purpose

This repository is a runnable full-stack MVP for detecting **motor empty-run** (and other abnormal operating states) from live motor telemetry.

In practical terms, it provides:

- A **sensor-side telemetry generator/publisher** (Python) to produce realistic motor signals.
- An **MQTT broker** (Mosquitto) to transport telemetry events.
- A **backend** (Node.js) that subscribes to MQTT, performs runtime feature engineering, runs **ONNX** inference, and stores results.
- A **MongoDB** datastore for telemetry history, alerts, and periodic model evaluation snapshots.
- A **React dashboard** that shows current state, trends, alerts, and a lightweight “model health” view.

## What “Empty Run” Means Here

“Empty run” is modeled as a motor running without load (e.g., belt snapped). In simulation, it typically looks like:

- RPM remains near normal,
- Current draw drops significantly,
- Vibration patterns shift,
- Power factor decreases.

The backend classifies each event into a state such as `NORMAL`, `EMPTY_RUN`, `STALLED`, `OFF`.

## Key Design Goal

The project is structured around an end-to-end industrial telemetry pattern:

**Edge/Sensors → MQTT → Real-time inference service → Time-series storage → Live dashboard**

This lets you demo both streaming ingestion and ML inference in a single stack.
