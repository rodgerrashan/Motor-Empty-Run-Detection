#pragma once

#include <Arduino.h>

class CurrentSensor {
public:
  CurrentSensor(int adcPin, float adcVref, int adcMax, float zeroV, float sensitivity);
  void begin();
  void calibrateZero(uint16_t samples, uint16_t settleMs = 500);
  float readCurrentA(uint16_t samples);

private:
  int adcPin_;
  float adcVref_;
  int adcMax_;
  float zeroV_;
  float sensitivity_;
};
