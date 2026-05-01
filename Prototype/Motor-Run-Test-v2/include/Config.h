#pragma once

namespace Config {
  // GPIO mapping (ESP32 NodeMCU-32S)
  constexpr int PIN_CURRENT_ADC = 34;  // ADC1_CH6, input only
  constexpr int PIN_VOLTAGE_ADC = 35;  // ADC1_CH7, input only
  constexpr int PIN_RELAY_CTRL = 27;   // GPIO27

  // ADC settings
  constexpr int ADC_MAX = 4095;
  constexpr float ADC_VREF = 3.3f;

  // ACS712 (20A) settings
  constexpr float ACS712_SUPPLY_V = 5.0f;
  constexpr float ACS712_ZERO_V = ACS712_SUPPLY_V * 0.5f;
  constexpr float ACS712_SENSITIVITY = 0.100f; // V/A for 20A module

  // Voltage divider (R1 from motor+ to ADC, R2 from ADC to GND)
  constexpr float VOLT_DIV_R1 = 30000.0f;  // 30k
  constexpr float VOLT_DIV_R2 = 10000.0f;  // 10k
  constexpr float VOLT_DIV_RATIO = (VOLT_DIV_R1 + VOLT_DIV_R2) / VOLT_DIV_R2;

  // Detection thresholds (tune these)
  constexpr float MOTOR_ON_VOLTAGE_MIN = 2.0f; // V
  constexpr float EMPTY_RUN_CURRENT_MAX = 0.25f; // A
  constexpr unsigned long EMPTY_RUN_HOLD_MS = 2000; // ms
  constexpr float LOAD_DROP_RATIO = 0.55f; // Trip if current < baseline * ratio
  constexpr float MIN_BASELINE_CURRENT = 0.30f; // A
  constexpr float BASELINE_ALPHA = 0.15f; // 0..1 (higher = faster adapt)
  constexpr float CURRENT_ON_THRESHOLD = 1.20f; // A

  // Sampling
  constexpr uint16_t SAMPLE_COUNT = 50;
  constexpr unsigned long LOOP_DELAY_MS = 100;
}
