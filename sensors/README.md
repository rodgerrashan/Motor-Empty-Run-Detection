# Motor Empty Run Detection — Sensors

This folder contains sensor-side scripts used to collect motor telemetry and publish it over MQTT for training and testing.

## Files (quick intro)

- `mqtt_publisher.py`  
    Reads sensor values and publishes them to an MQTT topic.  
    ```edge_ai/motor_efficiency```
# Sensors Module

This folder contains scripts to simulate motor telemetry, publish data over MQTT, and prepare training data for empty-run detection.

## Files

- `mqtt_publisher.py`  
    Publishes motor sensor values to an MQTT broker.  
    Includes CSV logging support for dataset creation.

- `init_csv.py`  
    Initializes the CSV file header/schema used by the publisher logger.

- `*.csv` (generated)  
    Output dataset used to train the motor empty-run detection model.

## Generate Motor Dataset (for model training)

1. Open `mqtt_publisher.py`.
2. **Uncomment** the calls/imports related to:
     - `init_csv()`
     - `log_data(payload)` function
3. Run `mqtt_publisher.py` to start publishing and logging sensor records.
4. Let it run long enough to capture both:
     - normal motor load
     - empty/no-load motor run
5. Stop the script and use the generated CSV file as model training input.

##