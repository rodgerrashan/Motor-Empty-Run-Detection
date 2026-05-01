#include "RelayController.h"

RelayController::RelayController(int pin, bool activeHigh)
  : pin_(pin), activeHigh_(activeHigh), stateOn_(false) {}

void RelayController::begin() {
  pinMode(pin_, OUTPUT);
  off();
}

void RelayController::on() {
  digitalWrite(pin_, activeHigh_ ? HIGH : LOW);
  stateOn_ = true;
}

void RelayController::off() {
  digitalWrite(pin_, activeHigh_ ? LOW : HIGH);
  stateOn_ = false;
}

bool RelayController::isOn() const {
  return stateOn_;
}
