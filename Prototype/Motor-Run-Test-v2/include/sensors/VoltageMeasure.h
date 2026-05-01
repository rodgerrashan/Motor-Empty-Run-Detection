#pragma once

#include <Arduino.h>

class VoltageMeasure {
public:
  VoltageMeasure(int adcPin, float adcVref, int adcMax, float ratio);
  void begin();
  float readVoltageV(uint16_t samples);

private:
  int adcPin_;
  float adcVref_;
  int adcMax_;
  float ratio_;
};
