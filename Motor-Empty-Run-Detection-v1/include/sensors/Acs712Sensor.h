#pragma once

#include <cstdint>

class Acs712Sensor {
public:
  void begin(int adcPin, float sensVPerA, float voutToAdcScale);
  void calibrateOffset(uint16_t samples = 400, uint16_t delayMs = 5);

  // RMS current magnitude estimate.
  float readRmsCurrentA(uint16_t samples = 250, uint16_t sampleDelayUs = 200);

private:
  int pin_ = -1;
  float sensVPerA_ = 0.100f;
  float voutToAdcScale_ = 1.0f;
  float offsetV_ = 1.65f;

  float adcToVolts_(uint16_t raw) const;
};
