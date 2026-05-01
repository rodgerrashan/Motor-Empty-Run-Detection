#include "RelayController.h"

RelayController::RelayController(int pin, bool activeHigh)
  : pin_(pin), activeHigh_(activeHigh), stateOn_(false) {}

void RelayController::begin() {
  // For active-low relay modules, using open-drain avoids the situation where
  // ESP32 drives HIGH at 3.3V but the module input is pulled up to 5V.
  // In open-drain, writing HIGH releases the line (high-Z) so the external
  // pull-up can bring it fully high and the relay turns OFF reliably.
  if (activeHigh_) {
    pinMode(pin_, OUTPUT);
  } else {
#ifdef OUTPUT_OPEN_DRAIN
    pinMode(pin_, OUTPUT_OPEN_DRAIN);
#else
    // Fallback: we'll switch to INPUT mode in off() to approximate high-Z.
    pinMode(pin_, OUTPUT);
#endif
  }
  off();
}

void RelayController::on() {
  // Ensure we are actively driving when turning ON.
  if (activeHigh_) {
    pinMode(pin_, OUTPUT);
    digitalWrite(pin_, HIGH);
  } else {
#ifdef OUTPUT_OPEN_DRAIN
    pinMode(pin_, OUTPUT_OPEN_DRAIN);
    digitalWrite(pin_, LOW);
#else
    pinMode(pin_, OUTPUT);
    digitalWrite(pin_, LOW);
#endif
  }
  stateOn_ = true;
}

void RelayController::off() {
  if (activeHigh_) {
    pinMode(pin_, OUTPUT);
    digitalWrite(pin_, LOW);
  } else {
#ifdef OUTPUT_OPEN_DRAIN
    pinMode(pin_, OUTPUT_OPEN_DRAIN);
    // HIGH on open-drain = released (high-Z)
    digitalWrite(pin_, HIGH);
#else
    // Release the line so any external pull-up can bring it high.
    pinMode(pin_, INPUT);
#endif
  }
  stateOn_ = false;
}

bool RelayController::isOn() const {
  return stateOn_;
}
