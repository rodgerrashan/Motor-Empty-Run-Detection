#include <Arduino.h>

#include "Config.h"
#include "RelayController.h"
#include "sensors/CurrentSensor.h"
#include "sensors/VoltageMeasure.h"

CurrentSensor currentSensor(
  Config::PIN_CURRENT_ADC,
  Config::ADC_VREF,
  Config::ADC_MAX,
  Config::ACS712_ZERO_V,
  Config::ACS712_SENSITIVITY
);

VoltageMeasure voltageMeasure(
  Config::PIN_VOLTAGE_ADC,
  Config::ADC_VREF,
  Config::ADC_MAX,
  Config::VOLT_DIV_RATIO
);

RelayController relay(Config::PIN_RELAY_CTRL, true);

bool isTripped = false;
unsigned long emptyStartMs = 0;

void setup() {
  Serial.begin(115200);

  analogReadResolution(12);
  analogSetPinAttenuation(Config::PIN_CURRENT_ADC, ADC_11db);
  analogSetPinAttenuation(Config::PIN_VOLTAGE_ADC, ADC_11db);

  currentSensor.begin();
  voltageMeasure.begin();
  relay.begin();
  relay.on();
}

void loop() {
  float currentA = currentSensor.readCurrentA(Config::SAMPLE_COUNT);
  float motorV = voltageMeasure.readVoltageV(Config::SAMPLE_COUNT);

  bool motorPowered = motorV >= Config::MOTOR_ON_VOLTAGE_MIN;
  bool emptyRun = currentA <= Config::EMPTY_RUN_CURRENT_MAX;

  if (!isTripped && motorPowered && emptyRun) {
    if (emptyStartMs == 0) {
      emptyStartMs = millis();
    } else if (millis() - emptyStartMs >= Config::EMPTY_RUN_HOLD_MS) {
      relay.off();
      isTripped = true;
    }
  } else {
    emptyStartMs = 0;
  }

  Serial.print("V=");
  Serial.print(motorV, 2);
  Serial.print("V  I=");
  Serial.print(currentA, 2);
  Serial.print("A  Relay=");
  Serial.print(relay.isOn() ? "ON" : "OFF");
  Serial.print("  Trip=");
  Serial.println(isTripped ? "YES" : "NO");

  delay(Config::LOOP_DELAY_MS);
}