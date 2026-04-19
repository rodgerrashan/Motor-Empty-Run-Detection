import time
import random

# Motor parameters
NORMAL_RPM = 1480
NORMAL_CURRENT = 15.5
NORMAL_VIB = 60.2
NORMAL_TEMP = 48.0

# Failure probabilities
BELT_SNAP_PROB = 0.008
STALL_PROB = 0.003
RECOVERY_PROB = 0.15

# Noise
NOISE_VIB = 0.8
NOISE_CURRENT = 0.4
NOISE_TEMP = 0.6


class MotorSimulator:
    def __init__(self):
        self.state = "NORMAL"
        self.cycle = 0
        self.temp = NORMAL_TEMP

    def get_state_description(self):
        return {
            "NORMAL": "Motor running with load",
            "EMPTY_RUN": "BELT SNAPPED - Empty Run",
            "STALLED": "MOTOR STALLED",
            "OFF": "Motor is OFF"
        }[self.state]

    def update_state(self, interval):
        if self.state == "NORMAL":
            if random.random() < BELT_SNAP_PROB * interval:
                self.state = "EMPTY_RUN"
            elif random.random() < STALL_PROB * interval:
                self.state = "STALLED"

        elif self.state in ["EMPTY_RUN", "STALLED"]:
            if random.random() < RECOVERY_PROB * interval:
                self.state = "NORMAL"

    def generate(self, interval=2.0):
        self.cycle += 1
        self.update_state(interval)

        if self.state == "NORMAL":
            rpm = NORMAL_RPM + random.gauss(0, 8)
            vibration = NORMAL_VIB + random.gauss(0, NOISE_VIB)
            current = NORMAL_CURRENT + random.gauss(0, NOISE_CURRENT)
            self.temp += (self.cycle % 300) / 60

        elif self.state == "EMPTY_RUN":
            rpm = NORMAL_RPM + random.gauss(0, 15)
            vibration = NORMAL_VIB * 0.85 + random.gauss(0, NOISE_VIB * 1.2)
            current = random.uniform(1.8, 3.2)
            self.temp = NORMAL_TEMP + random.gauss(5, 2)

        elif self.state == "STALLED":
            rpm = random.uniform(0, 80)
            vibration = random.uniform(8, 25)
            current = random.uniform(18, 28)
            self.temp = NORMAL_TEMP + 25 + random.gauss(0, 3)

        elif self.state == "OFF":
            rpm = 0
            vibration = random.uniform(0, 2)
            current = random.uniform(0, 0.3)
            self.temp = max(25, self.temp - 0.5)

        # Clamp
        rpm = max(0, min(1600, rpm))
        vibration = max(0, vibration)
        current = max(0, current)
        self.temp = max(20, self.temp)

        return {
            "state": self.state,
            "rpm": round(rpm, 1),
            "vibration_hz": round(vibration, 2),
            "current_amp": round(current, 2),
            "temperature_c": round(self.temp, 1),
            "power_factor": round(random.uniform(0.82, 0.95), 3)
            if self.state == "NORMAL"
            else round(random.uniform(0.4, 0.65), 3),
            "description": self.get_state_description()
        }