import mqtt from "mqtt";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { processTelemetry } from "../services/telemetryService.js";

let client;

export function startSubscriber() {
  client = mqtt.connect(config.mqtt.url, {
    clientId: config.mqtt.clientId,
    reconnectPeriod: 2000
  });

  client.on("connect", () => {
    logger.info("MQTT connected", { url: config.mqtt.url, topic: config.mqtt.topic });
    client.subscribe(config.mqtt.topic, (err) => {
      if (err) {
        logger.error("MQTT subscribe failed", { error: err.message });
      }
    });
  });

  client.on("message", async (_topic, message) => {
    try {
      const payload = JSON.parse(message.toString("utf8"));
      await processTelemetry(payload);
    } catch (error) {
      logger.warn("Failed to process MQTT message", { error: error.message });
    }
  });

  client.on("error", (error) => {
    logger.error("MQTT error", { error: error.message });
  });
}

export function stopSubscriber() {
  if (client) {
    client.end(true);
  }
}
