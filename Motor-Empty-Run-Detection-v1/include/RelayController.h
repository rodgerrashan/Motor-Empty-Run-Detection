#pragma once

class RelayController {
public:
  void begin(int pin, bool activeLow);
  void setOn(bool on);

private:
  int pin_ = -1;
  bool activeLow_ = true;
};
