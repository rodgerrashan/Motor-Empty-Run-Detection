import dotenv from "dotenv";

dotenv.config();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const config = {
  port: toInt(process.env.PORT, 8080),
  mongo: {
    uri: process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017",
    dbName: process.env.MONGO_DB_NAME || "motor_monitor",
    maxPoolSize: toInt(process.env.MONGO_MAX_POOL_SIZE, 50),
    minPoolSize: toInt(process.env.MONGO_MIN_POOL_SIZE, 5),
    maxIdleTimeMS: toInt(process.env.MONGO_MAX_IDLE_MS, 300000),
    connectTimeoutMS: toInt(process.env.MONGO_CONNECT_TIMEOUT_MS, 8000),
    socketTimeoutMS: toInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 30000),
    serverSelectionTimeoutMS: toInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 5000)
  },
  mqtt: {
    url: process.env.MQTT_URL || "mqtt://localhost:1883",
    topic: process.env.MQTT_TOPIC || "edge_ai/motor_efficiency",
    clientId: process.env.MQTT_CLIENT_ID || "backend-ingestor"
  },
  model: {
    modelPath: process.env.MODEL_PATH || "../mlModel/motor_fault_model.onnx",
    featureColumnsPath: process.env.FEATURE_COLUMNS_PATH || "../mlModel/feature_columns.json"
  },
  retention: {
    telemetryTtlSeconds: toInt(process.env.TELEMETRY_TTL_SECONDS, 2592000),
    alertsTtlSeconds: toInt(process.env.ALERTS_TTL_SECONDS, 7776000)
  },
  evaluation: {
    windowSize: toInt(process.env.EVAL_WINDOW_SIZE, 120),
    emitEvery: toInt(process.env.EVAL_EMIT_EVERY, 20)
  },
  alerting: {
    adminEmail: process.env.ALERT_ADMIN_EMAIL || "e20242@eng.pdn.ac.lk",
    enabled: process.env.ALERT_EMAIL_ENABLED === "true",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: toInt(process.env.SMTP_PORT, 587),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    fromAddress: process.env.ALERT_FROM_EMAIL || process.env.SMTP_USER || "motor-monitor@localhost",
    emailThrottleMinutes: toInt(process.env.ALERT_EMAIL_THROTTLE_MINUTES, 30),
    criticalTemperatureC: toInt(process.env.CRITICAL_TEMPERATURE_C, 100),
    criticalVibrationHz: toInt(process.env.CRITICAL_VIBRATION_HZ, 80),
    lockedRotorCurrentA: toInt(process.env.CRITICAL_LOCKED_ROTOR_CURRENT_A, 22),
    lockedRotorRpm: toInt(process.env.CRITICAL_LOCKED_ROTOR_RPM, 200)
  }
};
