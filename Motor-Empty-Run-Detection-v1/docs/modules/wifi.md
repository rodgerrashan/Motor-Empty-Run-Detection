# WifiManager module

Files:

- `include/net/WifiManager.h`
- `src/WifiManager.cpp`

## Purpose

- Owns Wi‑Fi station connection.
- Provides a blocking `ensureConnected()` that retries until connected.

## Key API

- `begin(ssid, password)`
- `ensureConnected()`
- `isConnected()`

## Notes

- If you want non-blocking reconnect, refactor `ensureConnected()` into a state machine.
