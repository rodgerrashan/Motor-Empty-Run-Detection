export function buildFeatureVector(payload) {
  const rpm = Number(payload.rpm ?? 0);
  const vibration_hz = Number(payload.vibration_hz ?? 0);
  const current_amp = Number(payload.current_amp ?? 0);
  const temperature_c = Number(payload.temperature_c ?? 0);
  const power_factor = Number(payload.power_factor ?? 0);

  const vib_per_amp = vibration_hz / (current_amp + 0.1);
  const current_ratio = current_amp / 15.5;
  const vibration_dev = Math.abs(vibration_hz - 60.2);
  const temp_rise = temperature_c - 48.0;
  const power_kw = (current_amp * 230 * power_factor) / 1000;
  const high_current_low_rpm = current_amp > 22 && rpm < 200 ? 1 : 0;

  return {
    rpm,
    vibration_hz,
    current_amp,
    temperature_c,
    power_factor,
    vib_per_amp,
    current_ratio,
    vibration_dev,
    temp_rise,
    power_kw,
    high_current_low_rpm
  };
}
