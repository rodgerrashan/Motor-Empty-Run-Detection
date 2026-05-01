#include "sensors/CurrentSensor.h"

#include <math.h>

CurrentSensor::CurrentSensor(int adcPin, float adcVref, int adcMax, float zeroV, float sensitivity)
  : adcPin_(adcPin), adcVref_(adcVref), adcMax_(adcMax), zeroV_(zeroV), sensitivity_(sensitivity) {}

void CurrentSensor::begin() {
  pinMode(adcPin_, INPUT);
}

void CurrentSensor::calibrateZero(uint16_t samples, uint16_t settleMs) {
  delay(settleMs);

  uint32_t total = 0;
  for (uint16_t i = 0; i < samples; ++i) {
    total += static_cast<uint32_t>(analogRead(adcPin_));
    delayMicroseconds(200);
  }

  float avg = static_cast<float>(total) / static_cast<float>(samples);
  zeroV_ = (avg / static_cast<float>(adcMax_)) * adcVref_;
}

float CurrentSensor::readCurrentA(uint16_t samples) {
  uint32_t total = 0;
  for (uint16_t i = 0; i < samples; ++i) {
    total += static_cast<uint32_t>(analogRead(adcPin_));
    delayMicroseconds(200);
  }

  float avg = static_cast<float>(total) / static_cast<float>(samples);
  float voltage = (avg / static_cast<float>(adcMax_)) * adcVref_;
  float current = (voltage - zeroV_) / sensitivity_;

  return fabsf(current);
}
