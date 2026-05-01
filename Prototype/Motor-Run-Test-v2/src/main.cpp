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

RelayController relay(Config::PIN_RELAY_CTRL, false);


void setup() {
  Serial.begin(115200);

  analogReadResolution(12);
  analogSetPinAttenuation(Config::PIN_CURRENT_ADC, ADC_11db);
  analogSetPinAttenuation(Config::PIN_VOLTAGE_ADC, ADC_11db);

  currentSensor.begin();
  voltageMeasure.begin();
  relay.begin();
  relay.off();

  Serial.println("Hold motor OFF for current zero calibration...");
  currentSensor.calibrateZero(400, 1500);
  Serial.println("Calibration done.");

  // With COM+NC wiring: relay OFF = motor connected, relay ON = motor disconnected.
  // Start with relay OFF (motor connected).
  relay.off();
}

void loop() {
  float currentA = currentSensor.readCurrentA(Config::SAMPLE_COUNT);
  float motorV = voltageMeasure.readVoltageV(Config::SAMPLE_COUNT);

  // With COM+NC wiring: energize relay to disconnect motor for 5s, then reconnect.
  // Relay is active-low, so ON = write LOW, OFF = released/high (handled by RelayController).
  if (!relay.isOn() && currentA > Config::CURRENT_ON_THRESHOLD) {
    Serial.println("Over-current: disconnecting motor (relay ON) for 5 seconds...");
    relay.on();
    Serial.print("Relay GPIO level after ON = ");
    Serial.println(digitalRead(Config::PIN_RELAY_CTRL));
    delay(5000);
    Serial.println("Reconnecting motor (relay OFF).");
    relay.off();
    Serial.print("Relay GPIO level after OFF = ");
    Serial.println(digitalRead(Config::PIN_RELAY_CTRL));
  }

  Serial.print("V=");
  Serial.print(motorV, 2);
  Serial.print("V  I=");
  Serial.print(currentA, 2);
  Serial.print("A  Relay=");
  Serial.print(relay.isOn() ? "ON" : "OFF");
  Serial.print("  Threshold=");
  Serial.print(Config::CURRENT_ON_THRESHOLD, 2);
  Serial.println("A");

  delay(Config::LOOP_DELAY_MS);
}