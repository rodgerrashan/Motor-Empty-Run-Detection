#include "RelayController.h"

#include <Arduino.h>

void RelayController::begin(int pin, bool activeLow) {
  pin_ = pin;
  activeLow_ = activeLow;
  pinMode(pin_, OUTPUT);
  // Default OFF for safety
  setOn(false);
}

void RelayController::setOn(bool on) {
  if (pin_ < 0) return;

  // Convert logical ON to the electrical pin level.
  // active-low: LOW=ON, HIGH=OFF
  bool levelHigh = activeLow_ ? !on : on;
  digitalWrite(pin_, levelHigh ? HIGH : LOW);
}
