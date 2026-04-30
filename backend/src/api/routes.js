import { Router } from "express";
import { getDb } from "../db/mongo.js";
import { generateReport } from "../services/reportService.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "motor-monitor-backend", ts: new Date().toISOString() });
});

router.get("/api/telemetry/latest", async (req, res, next) => {
  try {
    const db = getDb();
    const limit = Math.min(Number.parseInt(req.query.limit ?? "100", 10), 1000);
    const motorId = req.query.motorId ? String(req.query.motorId) : null;

    const filter = motorId ? { motor_id: motorId } : {};
    const rows = await db
      .collection("telemetry")
      .find(filter)
      .sort({ event_time: -1 })
      .limit(limit)
      .toArray();

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/api/alerts/recent", async (req, res, next) => {
  try {
    const db = getDb();
    const limit = Math.min(Number.parseInt(req.query.limit ?? "50", 10), 500);
    const rows = await db.collection("alerts").find({}).sort({ created_at: -1 }).limit(limit).toArray();
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/api/eval/latest", async (_req, res, next) => {
  try {
    const db = getDb();
    const row = await db.collection("model_eval").find({}).sort({ created_at: -1 }).limit(1).next();
    res.json(row ?? {});
  } catch (error) {
    next(error);
  }
});

router.get("/api/report/generate", async (req, res, next) => {
  try {
    const days = Math.min(Math.max(1, Number.parseInt(req.query.days ?? "1", 10)), 30);
    const pdfBuffer = await generateReport(days);
    const filename = `motor-report-${new Date().toISOString().split("T")[0]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || "internal_error" });
});
