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

router.get("/api/export/csv", async (req, res, next) => {
  try {
    const db = getDb();
    const days = Math.min(Math.max(1, Number.parseInt(req.query.days ?? "1", 10)), 30);
    const motorId = req.query.motorId ? String(req.query.motorId) : null;

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filter = { event_time: { $gte: cutoffDate } };
    if (motorId) filter.motor_id = motorId;

    const rows = await db
      .collection("telemetry")
      .find(filter)
      .sort({ event_time: -1 })
      .toArray();

    // CSV Header
    const headers = [
      "Timestamp",
      "Motor ID",
      "Predicted State",
      "Confidence",
      "Alert Code",
      "RPM",
      "Vibration (Hz)",
      "Current (A)",
      "Temperature (C)",
      "Power Factor",
      "Vib/Amp Ratio",
      "Current Ratio",
      "Vibration Dev",
      "Temp Rise",
      "Power (kW)",
      "Source State",
      "Source Status"
    ];

    // CSV Rows
    const csvRows = rows.map((row) => [
      row.event_time ? new Date(row.event_time).toISOString() : "",
      row.motor_id || "",
      row.predicted_state || "",
      row.confidence != null ? row.confidence.toFixed(4) : "",
      row.alert_code || "",
      row.raw?.rpm?.toFixed(2) || "",
      row.raw?.vibration_hz?.toFixed(2) || "",
      row.raw?.current_amp?.toFixed(2) || "",
      row.raw?.temperature_c?.toFixed(1) || "",
      row.raw?.power_factor?.toFixed(3) || "",
      row.engineered?.vib_per_amp?.toFixed(4) || "",
      row.engineered?.current_ratio?.toFixed(4) || "",
      row.engineered?.vibration_dev?.toFixed(2) || "",
      row.engineered?.temp_rise?.toFixed(1) || "",
      row.engineered?.power_kw?.toFixed(3) || "",
      row.source_state || "",
      row.source_status || ""
    ]);

    // Build CSV string with proper escaping
    const escapeCSV = (field) => {
      if (field == null) return "";
      const str = String(field);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeCSV).join(",");
    const dataLines = csvRows.map((row) => row.map(escapeCSV).join(",")).join("\n");
    const csv = `${headerLine}\n${dataLines}`;

    const filename = `motor-telemetry-${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

router.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || "internal_error" });
});
