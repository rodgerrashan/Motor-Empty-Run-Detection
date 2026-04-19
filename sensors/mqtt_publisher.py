import time
import json
import os
from datetime import datetime
import paho.mqtt.client as mqtt

try:
    # Works when run as: python -m sensors.mqtt_publisher
    from .motor import MotorSimulator
    from .data_logger import init_csv, log_data
except ImportError:
    # Works when run as: python sensors/mqtt_publisher.py
    from motor import MotorSimulator
    from data_logger import init_csv, log_data



# CONFIG
BROKER = os.getenv("MQTT_BROKER", "localhost")
PORT = int(os.getenv("MQTT_PORT", "1883"))
TOPIC = os.getenv("MQTT_TOPIC", "edge_ai/motor_efficiency")
INTERVAL = float(os.getenv("PUBLISH_INTERVAL_SECONDS", "2"))

# MQTT Setup
try:
    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
except (AttributeError, TypeError):
    # Backward compatibility with older paho-mqtt versions.
    client = mqtt.Client()
client.connect(BROKER, PORT, 60)

init_csv()
sim = MotorSimulator()

print("MQTT Motor Publisher Started")
print(f"Broker: {BROKER}:{PORT} | Topic: {TOPIC} | Interval: {INTERVAL}s\n")

while True:
    data = sim.generate(INTERVAL)

    rpm = data["rpm"]
    vibration = data["vibration_hz"]
    current = data["current_amp"]
    temp = data["temperature_c"]
    state = data["state"]

    # === EDGE AI LOGIC ===
    status = "HEALTHY"
    alert_code = 0
    confidence = 95

    if state == "EMPTY_RUN":
        status = "EMPTY RUN DETECTED"
        alert_code = 1
        confidence = 92
    elif state == "STALLED":
        status = "MOTOR STALLED"
        alert_code = 2
        confidence = 88
    elif vibration < 5 and current < 1:
        status = "OFF"
    elif current > 22 and rpm < 200:
        status = "LOCKED ROTOR"
        alert_code = 3

    payload = {
        "timestamp": time.time(),
        "motor_id": "MTR-001",
        **data,
        "status": status,
        "alert_code": alert_code,
        "confidence": confidence
    }

    client.publish(TOPIC, json.dumps(payload))

    print(f"[{datetime.now().strftime('%H:%M:%S')}] "
          f"RPM:{rpm} | Vib:{vibration} | Amp:{current} | Temp:{temp} | {status}")

    log_data(payload)
    time.sleep(INTERVAL)