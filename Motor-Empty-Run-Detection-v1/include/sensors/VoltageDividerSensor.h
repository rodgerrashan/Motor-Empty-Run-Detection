#pragma once

#include <cstdint>

class VoltageDividerSensor {
public:
  void begin(int adcPin, float dividerScale);
  float readVoltageV(uint16_t samples = 20, uint16_t sampleDelayMs = 1);

private:
  int pin_ = -1;
  float scale_ = 1.0f;

  float adcToVolts_(uint16_t raw) const;
};
