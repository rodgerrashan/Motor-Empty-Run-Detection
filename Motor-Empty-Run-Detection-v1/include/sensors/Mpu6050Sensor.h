#pragma once

#include <cstdint>
#include <cstddef>

struct Mpu6050Reading {
  float ax_g;
  float ay_g;
  float az_g;
  float temp_c;
};

class Mpu6050Sensor {
public:
  void begin(int sda, int scl, uint8_t addr);
  Mpu6050Reading read();

  // Lightweight “vibration frequency-ish” estimate for demos.
  float estimateVibrationHz(uint16_t durationMs = 500, uint16_t sampleRateHz = 200);

private:
  uint8_t addr_ = 0x68;

  void writeByte_(uint8_t reg, uint8_t value);
  void readBytes_(uint8_t reg, uint8_t* buf, std::size_t len);
};
