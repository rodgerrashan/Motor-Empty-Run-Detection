import csv
import os

# Resolve paths from this file location so execution works from any cwd.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILE_NAME = os.path.join(BASE_DIR, "dataset", "motor_dataset.csv")

HEADERS = [
    "timestamp",
    "motor_id",
    "rpm",
    "vibration_hz",
    "current_amp",
    "temperature_c",
    "power_factor",
    "state",
    "status",
    "alert_code",
]


def init_csv():
    os.makedirs(os.path.dirname(FILE_NAME), exist_ok=True)
    if not os.path.exists(FILE_NAME):
        with open(FILE_NAME, mode="w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(HEADERS)


def log_data(payload):
    with open(FILE_NAME, mode="a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                payload["timestamp"],
                payload["motor_id"],
                payload["rpm"],
                payload["vibration_hz"],
                payload["current_amp"],
                payload["temperature_c"],
                payload["power_factor"],
                payload["state"],
                payload["status"],
                payload["alert_code"],
            ]
        )

