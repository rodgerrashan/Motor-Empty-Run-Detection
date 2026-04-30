import { Router } from "express";
import { getDb } from "../db/mongo.js";
import { calculateHealthScore, getHealthHistory, getHealthStatus } from "../services/healthScoreService.js";
import { detectAnomalies, detectSuddenChanges, getAnomalyTrends } from "../services/anomalyDetectionService.js";
import {
  calculateEnergyMetrics,
  getEnergyTrends,
  getEnergyOptimization,
  getCostSavingsPotential
} from "../services/energyMetricsService.js";
import {
  detectDegradationTrends,
  getMaintenanceRecommendations,
  getMaintenanceSchedule,
  logMaintenanceAction
} from "../services/predictiveMaintenanceService.js";
import {
  createAlertRule,
  getAlertRules,
  evaluateRules,
  updateAlertRule,
  deleteAlertRule,
  getRuleAlertsHistory,
  getRuleStatistics,
  RULE_TEMPLATES
} from "../services/alertRulesEngine.js";

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

// ============== HEALTH SCORE ENDPOINTS ==============

router.get("/api/health/score/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const windowMinutes = Number.parseInt(req.query.window ?? "60", 10);
    const result = await calculateHealthScore(motorId, windowMinutes);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/api/health/history/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const hours = Number.parseInt(req.query.hours ?? "24", 10);
    const interval = Number.parseInt(req.query.interval ?? "30", 10);
    const history = await getHealthHistory(motorId, hours, interval);
    res.json({ motor_id: motorId, history });
  } catch (error) {
    next(error);
  }
});

router.get("/api/health/status/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const score = await calculateHealthScore(motorId);
    const status = getHealthStatus(score.score);
    res.json({ motor_id: motorId, score: score.score, status });
  } catch (error) {
    next(error);
  }
});

// ============== ANOMALY DETECTION ENDPOINTS ==============

router.get("/api/anomalies/detect/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const window = Number.parseInt(req.query.window ?? "120", 10);
    const result = await detectAnomalies(motorId, window);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/api/anomalies/changes/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const window = Number.parseInt(req.query.window ?? "60", 10);
    const threshold = Number.parseInt(req.query.threshold ?? "20", 10);
    const result = await detectSuddenChanges(motorId, window, threshold);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/api/anomalies/trends/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const interval = Number.parseInt(req.query.interval ?? "1", 10);
    const lookback = Number.parseInt(req.query.lookback ?? "24", 10);
    const trends = await getAnomalyTrends(motorId, interval, lookback);
    res.json({ motor_id: motorId, trends });
  } catch (error) {
    next(error);
  }
});

// ============== ENERGY METRICS ENDPOINTS ==============

router.get("/api/energy/metrics/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const window = Number.parseInt(req.query.window ?? "60", 10);
    const result = await calculateEnergyMetrics(motorId, window);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/api/energy/trends/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const interval = Number.parseInt(req.query.interval ?? "1", 10);
    const lookback = Number.parseInt(req.query.lookback ?? "24", 10);
    const trends = await getEnergyTrends(motorId, interval, lookback);
    res.json({ motor_id: motorId, trends });
  } catch (error) {
    next(error);
  }
});

router.get("/api/energy/optimization/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const window = Number.parseInt(req.query.window ?? "1440", 10);
    const result = await getEnergyOptimization(motorId, window);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/api/energy/savings/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const window = Number.parseInt(req.query.window ?? "1440", 10);
    const result = await getCostSavingsPotential(motorId, window);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============== PREDICTIVE MAINTENANCE ENDPOINTS ==============

router.get("/api/maintenance/trends/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const hours = Number.parseInt(req.query.hours ?? "168", 10);
    const result = await detectDegradationTrends(motorId, hours);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/api/maintenance/recommendations/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const result = await getMaintenanceRecommendations(motorId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/api/maintenance/schedule/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const result = await getMaintenanceSchedule(motorId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/api/maintenance/log/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const { actionType, notes } = req.body;
    const result = await logMaintenanceAction(motorId, actionType, notes);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============== ALERT RULES ENDPOINTS ==============

router.get("/api/rules/templates", (_req, res) => {
  const templates = Object.entries(RULE_TEMPLATES).map(([key, template]) => ({
    template_id: key,
    ...template
  }));
  res.json({ templates });
});

router.post("/api/rules/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const result = await createAlertRule(motorId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/api/rules/:motorId", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const result = await getAlertRules(motorId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.put("/api/rules/:motorId/:ruleId", async (req, res, next) => {
  try {
    const result = await updateAlertRule(req.params.ruleId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete("/api/rules/:motorId/:ruleId", async (req, res, next) => {
  try {
    const result = await deleteAlertRule(req.params.ruleId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/api/rules/:motorId/alerts/history", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const limit = Number.parseInt(req.query.limit ?? "100", 10);
    const hours = Number.parseInt(req.query.hours ?? "24", 10);
    const result = await getRuleAlertsHistory(motorId, limit, hours);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/api/rules/:motorId/statistics", async (req, res, next) => {
  try {
    const motorId = req.params.motorId;
    const result = await getRuleStatistics(motorId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============== ERROR HANDLING ==============

router.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || "internal_error" });
});
