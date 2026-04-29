#pragma once

#include <Arduino.h>

class RelayController {
public:
  RelayController(int pin, bool activeHigh = true);
  void begin();
  void on();
  void off();
  bool isOn() const;

private:
  int pin_;
  bool activeHigh_;
  bool stateOn_;
};
