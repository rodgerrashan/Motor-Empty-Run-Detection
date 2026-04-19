const asText = (payload) => {
  if (payload == null) return "";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

export const logger = {
  info(message, payload) {
    console.log(`[INFO] ${new Date().toISOString()} ${message} ${asText(payload)}`.trim());
  },
  warn(message, payload) {
    console.warn(`[WARN] ${new Date().toISOString()} ${message} ${asText(payload)}`.trim());
  },
  error(message, payload) {
    console.error(`[ERROR] ${new Date().toISOString()} ${message} ${asText(payload)}`.trim());
  }
};
