import { MongoClient } from "mongodb";
import { config } from "../config.js";
import { logger } from "../logger.js";

let client;
let db;

export async function connectMongo() {
  if (db) return db;

  client = new MongoClient(config.mongo.uri, {
    maxPoolSize: config.mongo.maxPoolSize,
    minPoolSize: config.mongo.minPoolSize,
    maxIdleTimeMS: config.mongo.maxIdleTimeMS,
    connectTimeoutMS: config.mongo.connectTimeoutMS,
    socketTimeoutMS: config.mongo.socketTimeoutMS,
    serverSelectionTimeoutMS: config.mongo.serverSelectionTimeoutMS
  });

  await client.connect();
  db = client.db(config.mongo.dbName);

  await db.collection("telemetry").createIndex({ event_time: -1 });
  await db.collection("telemetry").createIndex(
    { event_time: 1 },
    { expireAfterSeconds: config.retention.telemetryTtlSeconds }
  );
  await db.collection("telemetry").createIndex({ motor_id: 1, event_time: -1 });

  await db.collection("alerts").createIndex({ created_at: -1 });
  await db.collection("alerts").createIndex(
    { created_at: 1 },
    { expireAfterSeconds: config.retention.alertsTtlSeconds }
  );
  await db.collection("alerts").createIndex({ motor_id: 1, created_at: -1 });

  await db.collection("alert_notifications").createIndex({ sent_at: -1 });
  await db.collection("alert_notifications").createIndex({ motor_id: 1, condition_key: 1, sent_at: -1 });

  await db.collection("model_eval").createIndex({ created_at: -1 });
  await db.collection("model_registry").createIndex({ model_version: 1 }, { unique: true });

  logger.info("MongoDB connected", { dbName: config.mongo.dbName });
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("Mongo is not connected");
  }
  return db;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
