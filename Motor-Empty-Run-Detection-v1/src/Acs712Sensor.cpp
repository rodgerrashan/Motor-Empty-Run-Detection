#include "sensors/Acs712Sensor.h"

#include <Arduino.h>
#include <cmath>

void Acs712Sensor::begin(int adcPin, float sensVPerA, float voutToAdcScale) {
  pin_ = adcPin;
  sensVPerA_ = sensVPerA;
  voutToAdcScale_ = voutToAdcScale;
}

float Acs712Sensor::adcToVolts_(uint16_t raw) const {
  return (raw / 4095.0f) * 3.3f;
}

void Acs712Sensor::calibrateOffset(uint16_t samples, uint16_t delayMs) {
  double sum = 0.0;
  for (uint16_t i = 0; i < samples; i++) {
    uint16_t raw = analogRead(pin_);
    float vAdc = adcToVolts_(raw);
    float vAtSensor = vAdc * voutToAdcScale_;
    sum += vAtSensor;
    delay(delayMs);
  }
  offsetV_ = (float)(sum / samples);

  Serial.print("ACS712 offset V = ");
  Serial.println(offsetV_, 4);
}

float Acs712Sensor::readRmsCurrentA(uint16_t samples, uint16_t sampleDelayUs) {
  double sumSq = 0.0;
  for (uint16_t i = 0; i < samples; i++) {
    uint16_t raw = analogRead(pin_);
    float vAdc = adcToVolts_(raw);
    float vAtSensor = vAdc * voutToAdcScale_;
    float centered = vAtSensor - offsetV_;
    sumSq += (double)centered * (double)centered;
    delayMicroseconds(sampleDelayUs);
  }

  float vRms = sqrt(sumSq / samples);
  float iRms = vRms / sensVPerA_;
  if (!isfinite(iRms) || iRms < 0.0f) {
    return 0.0f;
  }
  return iRms;
}
