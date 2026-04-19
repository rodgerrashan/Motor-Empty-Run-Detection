import http from "node:http";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { connectMongo, closeMongo } from "./db/mongo.js";
import { loadModel } from "./ml/onnxService.js";
import { startSubscriber, stopSubscriber } from "./mqtt/subscriber.js";
import { initWsHub } from "./realtime/wsHub.js";
import { router } from "./api/routes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(router);

const server = http.createServer(app);
initWsHub(server);

async function start() {
  await connectMongo();
  const modelInfo = await loadModel();
  logger.info("ONNX model loaded", modelInfo);

  startSubscriber();

  server.listen(config.port, () => {
    logger.info(`Backend listening on port ${config.port}`);
  });
}

async function shutdown(signal) {
  logger.info(`Shutdown signal received: ${signal}`);
  stopSubscriber();
  server.close(async () => {
    await closeMongo();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  logger.error("Startup failed", { error: error.message });
  process.exit(1);
});
