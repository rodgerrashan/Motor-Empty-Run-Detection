#include "sensors/VoltageMeasure.h"

VoltageMeasure::VoltageMeasure(int adcPin, float adcVref, int adcMax, float ratio)
  : adcPin_(adcPin), adcVref_(adcVref), adcMax_(adcMax), ratio_(ratio) {}

void VoltageMeasure::begin() {
  pinMode(adcPin_, INPUT);
}

float VoltageMeasure::readVoltageV(uint16_t samples) {
  uint32_t total = 0;
  for (uint16_t i = 0; i < samples; ++i) {
    total += static_cast<uint32_t>(analogRead(adcPin_));
    delayMicroseconds(200);
  }

  float avg = static_cast<float>(total) / static_cast<float>(samples);
  float voltage = (avg / static_cast<float>(adcMax_)) * adcVref_;

  return voltage * ratio_;
}
