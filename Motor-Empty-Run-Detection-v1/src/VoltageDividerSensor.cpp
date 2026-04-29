#include "sensors/VoltageDividerSensor.h"

#include <Arduino.h>

void VoltageDividerSensor::begin(int adcPin, float dividerScale) {
  pin_ = adcPin;
  scale_ = dividerScale;
}

float VoltageDividerSensor::adcToVolts_(uint16_t raw) const {
  return (raw / 4095.0f) * 3.3f;
}

float VoltageDividerSensor::readVoltageV(uint16_t samples, uint16_t sampleDelayMs) {
  double sum = 0.0;
  for (uint16_t i = 0; i < samples; i++) {
    sum += analogRead(pin_);
    delay(sampleDelayMs);
  }

  float avgRaw = (float)(sum / samples);
  float vAdc = adcToVolts_((uint16_t)avgRaw);
  return vAdc * scale_;
}
