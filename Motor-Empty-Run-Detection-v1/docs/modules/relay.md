# RelayController module

Files:

- `include/RelayController.h`
- `src/RelayController.cpp`

## Purpose

- Drive a relay **module** (or transistor driver) from ESP32 GPIO.

## Key API

- `begin(pin, activeLow)`
- `setOn(bool)`

## Electrical notes

- Do not drive a bare relay coil directly from GPIO.
- Use a relay module or a transistor + flyback diode.
- Relay is for ON/OFF only (do not PWM).
