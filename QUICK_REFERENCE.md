# 🎯 Quick Reference Card

**Motor Monitoring System v2.0 - Innovation Features Quick Guide**

---

## 🏥 Health Score System

**What it does:** Real-time motor health (0-100)

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/health/score/{motorId}` | Current score | `{ "score": 87, "status": "EXCELLENT" }` |
| `GET /api/health/status/{motorId}` | Status only | `{ "score": 87, "status": "EXCELLENT" }` |
| `GET /api/health/history/{motorId}?hours=24` | History | `{ "history": [...] }` |

**Status Levels:**
- ✅ EXCELLENT (85+) - Optimal
- 🟢 GOOD (70-84) - Normal
- 🟡 WARNING (50-69) - Degrading
- 🔴 CRITICAL (30-49) - Urgent
- ⚫ FAILED (<30) - Failed

**Query Params:**
- `window` - Time window in minutes (default: 60)
- `hours` - Lookback hours for history (default: 24)
- `interval` - History sample interval in minutes (default: 30)

---

## 🔍 Anomaly Detection

**What it does:** Statistical outlier detection

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/anomalies/detect/{motorId}` | Find anomalies | `{ "anomaly_count": 3, "anomalies": [...] }` |
| `GET /api/anomalies/changes/{motorId}` | Sudden changes | `{ "change_count": 2, "changes": [...] }` |
| `GET /api/anomalies/trends/{motorId}` | Trend analysis | `{ "trends": [...] }` |

**Detection Methods:**
- **Z-Score** - Values >3σ from mean (99.7% confidence)
- **IQR** - Outliers beyond 1.5×IQR
- **Change Detection** - Rapid value increases

**Query Params:**
- `window` - Time window in minutes (default: 120)
- `threshold` - Change threshold % (default: 20)
- `interval` - Trend interval hours (default: 1)
- `lookback` - Lookback hours (default: 24)

---

## ⚡ Energy Metrics

**What it does:** Power consumption & efficiency tracking

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/energy/metrics/{motorId}` | Current metrics | `{ "energy": {...}, "cost": {...}, "efficiency": {...} }` |
| `GET /api/energy/trends/{motorId}` | Historical trends | `{ "trends": [...] }` |
| `GET /api/energy/optimization/{motorId}` | Optimization tips | `{ "improvement": {...} }` |
| `GET /api/energy/savings/{motorId}` | Cost savings | `{ "annualized_savings": 3650 }` |

**Key Metrics:**
- Energy (kWh) - Kilowatt-hours consumed
- Cost (USD) - Estimated operating cost
- Carbon (kg CO2) - Environmental impact
- Efficiency (%) - 0-100 rating

**Query Params:**
- `window` - Time window in minutes (default: 60)
- `interval` - Trend interval hours (default: 1)
- `lookback` - Lookback hours (default: 24)

---

## 🔮 Predictive Maintenance

**What it does:** Failure prediction & recommendations

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/maintenance/trends/{motorId}` | Degradation | `{ "risk_level": "HIGH", "predicted_failure": {...} }` |
| `GET /api/maintenance/recommendations/{motorId}` | Actions | `{ "recommendations": [...] }` |
| `GET /api/maintenance/schedule/{motorId}` | Schedule | `{ "scheduled_maintenance": [...] }` |
| `POST /api/maintenance/log/{motorId}` | Log action | `{ "success": true, "maintenance_id": "..." }` |

**Risk Levels:**
- 🟢 LOW - No action needed
- 🟡 MEDIUM - Schedule maintenance
- 🟠 HIGH - Urgent scheduling
- 🔴 CRITICAL - Immediate action

**POST Body Example:**
```json
{
  "actionType": "bearing_replacement",
  "notes": "Replaced worn bearings"
}
```

**Query Params:**
- `hours` - Analysis window hours (default: 168)

---

## 🚨 Alert Rules Engine

**What it does:** Custom event-based alerting

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/rules/templates` | Rule templates | `{ "templates": [...] }` |
| `POST /api/rules/{motorId}` | Create rule | `{ "success": true, "rule_id": "..." }` |
| `GET /api/rules/{motorId}` | List rules | `{ "total_rules": 5, "rules": [...] }` |
| `PUT /api/rules/{motorId}/{ruleId}` | Update rule | `{ "success": true }` |
| `DELETE /api/rules/{motorId}/{ruleId}` | Delete rule | `{ "success": true }` |
| `GET /api/rules/{motorId}/alerts/history` | Alert history | `{ "total_alerts": 45, "alerts": [...] }` |
| `GET /api/rules/{motorId}/statistics` | Statistics | `{ "total_rules": 5, "top_triggered": [...] }` |

**Pre-built Templates:**
- `TEMPERATURE_HIGH` - Temp > 75°C
- `TEMPERATURE_CRITICAL` - Temp > 85°C
- `VIBRATION_HIGH` - Vib > 100 Hz
- `VIBRATION_CRITICAL` - Vib > 130 Hz
- `CURRENT_HIGH` - Current > 25 A
- `POWER_FACTOR_LOW` - PF < 0.85
- `EMPTY_RUN` - State = "EMPTY_RUN"
- `STALLED` - State = "STALLED"
- `LOW_CONFIDENCE` - Confidence < 0.7

**POST Body Example:**
```json
{
  "name": "High Temperature Alert",
  "condition": "raw.temperature_c > 75",
  "severity": "WARNING",
  "enabled": true
}
```

**Condition Fields:**
- `raw.rpm` - Motor RPM
- `raw.temperature_c` - Temperature °C
- `raw.vibration_hz` - Vibration Hz
- `raw.current_amp` - Current Amps
- `raw.power_factor` - Power factor (0-1)
- `predicted_state` - State string
- `confidence` - Model confidence (0-1)
- `engineered.*` - Any engineered feature

**Severity Levels:**
- INFO - Informational only
- WARNING - Should be addressed
- CRITICAL - Requires immediate action

---

## 📡 WebSocket Events

Connect: `ws://localhost:8080/ws`

```javascript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  // msg.type can be:
  // - "telemetry" - Sensor data
  // - "alert" - Predicted anomaly
  // - "rule_alert" - Custom rule triggered
  // - "model_eval" - Model evaluation
};
```

---

## 🔑 Common Parameters

| Param | Type | Default | Max | Usage |
|-------|------|---------|-----|-------|
| `motorId` | string | required | - | `{motorId}` in URL |
| `window` | int | 60 | 1440 | Minutes for analysis |
| `hours` | int | 24 | - | Hours lookback |
| `interval` | int | 1 | 24 | Hours between samples |
| `limit` | int | 50-100 | 1000 | Results to return |
| `threshold` | int | 20 | 100 | Change % threshold |

---

## 📊 Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | `{"score": 87}` |
| 400 | Bad request | Invalid motorId |
| 404 | Not found | Motor doesn't exist |
| 500 | Server error | Database connection failed |

---

## 🚀 Common Workflows

### Monitor Single Motor
```bash
# Health
curl http://localhost:8080/api/health/score/motor_1

# Energy
curl http://localhost:8080/api/energy/metrics/motor_1

# Maintenance
curl http://localhost:8080/api/maintenance/recommendations/motor_1

# Rules
curl http://localhost:8080/api/rules/motor_1
```

### Set Up Alerts
```bash
# Get templates
curl http://localhost:8080/api/rules/templates

# Create rule
curl -X POST http://localhost:8080/api/rules/motor_1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Temp>75","condition":"raw.temperature_c > 75","severity":"WARNING"}'

# Check history
curl http://localhost:8080/api/rules/motor_1/alerts/history
```

### Monitor All Metrics
```bash
# Health Score
/api/health/score/motor_1?window=60

# Anomalies
/api/anomalies/detect/motor_1?window=120

# Energy
/api/energy/metrics/motor_1?window=60

# Maintenance
/api/maintenance/trends/motor_1?hours=168
```

---

## ⚡ Performance Tips

| Task | Time | Optimization |
|------|------|-------------|
| Health Score | <100ms | Cache for 30s |
| Anomaly Detect | <200ms | Batch 10 motors |
| Energy Metrics | <150ms | Pre-calculate hourly |
| Maintenance | <300ms | Schedule as background job |
| Rule Eval | <50ms | Should be fast enough |

---

## 📱 Browser/Client Support

### Required
- Modern browser with ES6 support
- WebSocket support (for real-time)
- Fetch API (for REST)

### Tested On
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 🔧 Configuration Defaults

| Setting | Value | Location |
|---------|-------|----------|
| Cost per kWh | $0.12 | energyMetricsService.js |
| Carbon intensity | 0.233 kg/kWh | energyMetricsService.js |
| Temp threshold critical | 85°C | healthScoreService.js |
| Vibration threshold | 120 Hz | predictiveMaintenanceService.js |
| Health score window | 60 minutes | routes.js |
| Data retention | 90 days | mongo.js (TTL index) |

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| No health data | Ensure 60+ telemetry records exist |
| Empty anomalies | Need 5+ samples, check Z-score threshold |
| Rules not triggering | Check condition syntax, verify rule enabled |
| WebSocket fails | Check VITE_WS_URL in frontend |
| Slow queries | Add compound indices on motor_id + timestamp |

---

## 📚 Documentation Map

| Need | Document | Section |
|------|----------|---------|
| Feature overview | README_INNOVATIONS.md | New Features |
| API details | API_REFERENCE.md | Complete list |
| Setup help | INTEGRATION_GUIDE.md | Step-by-step |
| Code examples | EXAMPLES_AND_SCENARIOS.md | Real-world use |
| Detailed info | INNOVATIONS.md | Each feature |

---

**Version:** 2.0.0 | **Status:** ✅ Production Ready | **Last Updated:** April 30, 2024
