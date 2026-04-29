#include "sensors/Mpu6050Sensor.h"

#include <Arduino.h>
#include <Wire.h>
#include <cmath>

void Mpu6050Sensor::begin(int sda, int scl, uint8_t addr) {
  addr_ = addr;
  Wire.begin(sda, scl);

  // Wake up
  writeByte_(0x6B, 0x00);
  // Accel +/-2g
  writeByte_(0x1C, 0x00);
  // Gyro +/-250 dps
  writeByte_(0x1B, 0x00);
}

void Mpu6050Sensor::writeByte_(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(addr_);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission(true);
}

void Mpu6050Sensor::readBytes_(uint8_t reg, uint8_t* buf, std::size_t len) {
  Wire.beginTransmission(addr_);
  Wire.write(reg);
  Wire.endTransmission(false);

  Wire.requestFrom((int)addr_, (int)len, (int)true);
  for (size_t i = 0; i < len && Wire.available(); i++) {
    buf[i] = (uint8_t)Wire.read();
  }
}

Mpu6050Reading Mpu6050Sensor::read() {
  uint8_t data[14] = {0};
  readBytes_(0x3B, data, 14);

  int16_t ax = (int16_t)((data[0] << 8) | data[1]);
  int16_t ay = (int16_t)((data[2] << 8) | data[3]);
  int16_t az = (int16_t)((data[4] << 8) | data[5]);
  int16_t t = (int16_t)((data[6] << 8) | data[7]);

  Mpu6050Reading r;
  r.ax_g = ax / 16384.0f;
  r.ay_g = ay / 16384.0f;
  r.az_g = az / 16384.0f;
  r.temp_c = (t / 340.0f) + 36.53f;
  return r;
}

float Mpu6050Sensor::estimateVibrationHz(uint16_t durationMs, uint16_t sampleRateHz) {
  if (sampleRateHz < 20) sampleRateHz = 20;
  const float seconds = durationMs / 1000.0f;
  const uint16_t n = (uint16_t)(seconds * sampleRateHz);

  float prevMag = 0.0f;
  float hp = 0.0f;
  const float alpha = 0.95f;

  int signPrev = 0;
  uint32_t signChanges = 0;

  const uint32_t stepMs = 1000 / sampleRateHz;
  for (uint16_t i = 0; i < n; i++) {
    Mpu6050Reading r = read();
    float mag = sqrtf(r.ax_g * r.ax_g + r.ay_g * r.ay_g + r.az_g * r.az_g);

    hp = alpha * (hp + mag - prevMag);
    prevMag = mag;

    int signNow = (hp > 0.0f) ? 1 : (hp < 0.0f ? -1 : 0);
    if (signPrev != 0 && signNow != 0 && signNow != signPrev) {
      signChanges++;
    }
    if (signNow != 0) signPrev = signNow;

    delay(stepMs);
  }

  float hz = (signChanges / 2.0f) / (seconds > 0.0f ? seconds : 1.0f);
  if (!isfinite(hz) || hz < 0.0f) hz = 0.0f;
  if (hz > (float)sampleRateHz / 2.0f) hz = (float)sampleRateHz / 2.0f;
  return hz;
}
