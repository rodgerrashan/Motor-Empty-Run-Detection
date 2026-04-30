# Innovative Features Documentation

This document describes the cutting-edge features added to the Motor Empty-Run Detection system.

## Overview of New Features

### 1. **Health Score System** 
Real-time motor health assessment (0-100 score) based on multiple factors.

**What it does:**
- Calculates composite health score based on:
  - Motor state distribution
  - Temperature stability
  - Vibration patterns
  - Prediction confidence
  - Overheating and high-vibration penalties

**Health Status Levels:**
- **EXCELLENT** (85+) - Motor operating optimally
- **GOOD** (70-84) - Normal operation
- **WARNING** (50-69) - Some degradation detected
- **CRITICAL** (30-49) - Immediate attention needed
- **FAILED** (<30) - Critical failure imminent

**API Endpoints:**
```
GET /api/health/score/{motorId}?window=60
GET /api/health/history/{motorId}?hours=24&interval=30
GET /api/health/status/{motorId}
```

**Example Response:**
```json
{
  "score": 87,
  "status": "EXCELLENT",
  "window_minutes": 60,
  "sample_count": 120,
  "details": {
    "state_score": 95,
    "temp_variability": 0.08,
    "vib_variability": 0.12,
    "avg_confidence": 0.96
  }
}
```

---

### 2. **Anomaly Detection Engine** 
Statistical anomaly detection independent of ML model predictions.

**Detection Methods:**
- **Z-Score Method** - Detects values >3σ from mean (99.7% confidence)
- **IQR Method** - Identifies outliers beyond 1.5×IQR bounds
- **Sudden Change Detection** - Tracks rapid value changes

**Features Monitored:**
- RPM, Vibration, Current Draw, Temperature, Power Factor

**API Endpoints:**
```
GET /api/anomalies/detect/{motorId}?window=120
GET /api/anomalies/changes/{motorId}?window=60&threshold=20
GET /api/anomalies/trends/{motorId}?interval=1&lookback=24
```

**Example Response:**
```json
{
  "motor_id": "motor_1",
  "anomaly_count": 3,
  "anomalies": [
    {
      "timestamp": "2024-04-30T10:15:00Z",
      "feature": "temperature_c",
      "value": 92,
      "z_score": 3.8,
      "severity": "HIGH",
      "method": "Z-SCORE"
    }
  ]
}
```

---

### 3. **Energy Efficiency Metrics**
Comprehensive power consumption and efficiency analysis.

**Metrics Calculated:**
- Total energy consumption (kWh)
- Average power draw (kW)
- Power factor analysis
- Estimated operating cost (USD)
- Carbon emissions (kg CO2)
- Efficiency rating (0-100)

**Features:**
- Cost per kWh tracking ($0.12/kWh default)
- Carbon intensity tracking (0.233 kg CO2/kWh average)
- Efficiency trend analysis
- Cost savings potential estimation

**API Endpoints:**
```
GET /api/energy/metrics/{motorId}?window=60
GET /api/energy/trends/{motorId}?interval=1&lookback=24
GET /api/energy/optimization/{motorId}?window=1440
GET /api/energy/savings/{motorId}?window=1440
```

**Example Response:**
```json
{
  "motor_id": "motor_1",
  "energy": {
    "total_kwh": 1.25,
    "avg_power_kw": 1.25,
    "avg_power_factor": 0.92
  },
  "cost": {
    "estimated_usd": 0.15,
    "rate_usd_per_kwh": 0.12
  },
  "emissions": {
    "carbon_kg": 0.291,
    "equivalent_tree_hours": 12.1
  },
  "efficiency": {
    "score": 88.5,
    "rating": "EXCELLENT"
  }
}
```

---

### 4. **Predictive Maintenance System**
AI-powered maintenance predictions with trend analysis.

**Capabilities:**
- **Degradation Trend Detection** - Identifies upward trends in temperature, vibration, current
- **Failure Time Prediction** - Estimates hours until equipment failure
- **Smart Recommendations** - Generates actionable maintenance tasks
- **Exponential Smoothing** - Accounts for recent trends with less weight on old data

**Thresholds for Prediction:**
- Temperature: >85°C critical
- Vibration: >120 Hz critical
- Current: >28 A critical

**API Endpoints:**
```
GET /api/maintenance/trends/{motorId}?hours=168
GET /api/maintenance/recommendations/{motorId}
GET /api/maintenance/schedule/{motorId}
POST /api/maintenance/log/{motorId}
```

**Example Response:**
```json
{
  "motor_id": "motor_1",
  "risk_level": "HIGH",
  "risk_score": 72,
  "predicted_failure": {
    "predicted": true,
    "critical_factor": "temperature",
    "hours_to_maintenance": 42.5,
    "maintenance_date": "2024-05-01T04:30:00Z"
  },
  "recommendations": [
    {
      "priority": "URGENT",
      "action": "Schedule maintenance within 2 days",
      "reason": "Temperature approaching critical threshold"
    }
  ]
}
```

---

### 5. **Customizable Alert Rules Engine**
Rule-based alerting system with flexible conditions.

**Pre-built Templates:**
```
TEMPERATURE_HIGH          - Temp > 75°C
TEMPERATURE_CRITICAL      - Temp > 85°C
VIBRATION_HIGH           - Vibration > 100 Hz
VIBRATION_CRITICAL       - Vibration > 130 Hz
CURRENT_HIGH             - Current > 25 A
POWER_FACTOR_LOW         - Power Factor < 0.85
EMPTY_RUN                - State = "EMPTY_RUN"
STALLED                  - State = "STALLED"
LOW_CONFIDENCE           - Confidence < 0.7
```

**Features:**
- Custom condition definitions (any comparison logic)
- Three severity levels: INFO, WARNING, CRITICAL
- Trigger counting and tracking
- Real-time alert broadcasting via WebSocket

**API Endpoints:**
```
GET  /api/rules/templates
POST /api/rules/{motorId}
GET  /api/rules/{motorId}
PUT  /api/rules/{motorId}/{ruleId}
DELETE /api/rules/{motorId}/{ruleId}
GET  /api/rules/{motorId}/alerts/history
GET  /api/rules/{motorId}/statistics
```

**Create Custom Rule Example:**
```bash
curl -X POST http://localhost:8080/api/rules/motor_1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Excessive Vibration",
    "description": "Alert when vibration exceeds safe levels",
    "condition": "raw.vibration_hz > 95",
    "severity": "WARNING",
    "enabled": true
  }'
```

**Example Rule Alert Response:**
```json
{
  "motor_id": "motor_1",
  "rule_name": "High Temperature Alert",
  "severity": "WARNING",
  "created_at": "2024-04-30T10:15:00Z",
  "message": "High Temperature Alert: Temperature: 78.5°C | Current: 22.3 A",
  "trigger_count": 145,
  "last_triggered": "2024-04-30T10:15:00Z"
}
```

---

## Quick Start Guide

### Using the Enhanced Dashboard

```javascript
import EnhancedDashboard from "./EnhancedDashboard.jsx";

export default function App() {
  return <EnhancedDashboard />;
}
```

The dashboard includes:
- Real-time health score gauge
- Energy consumption tracking
- Anomaly detection alerts
- Maintenance recommendations
- Live sensor trend charts

### Creating Custom Monitoring Rules

```bash
# Get available templates
curl http://localhost:8080/api/rules/templates

# Create a custom rule
curl -X POST http://localhost:8080/api/rules/motor_1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Current + Low RPM",
    "condition": "raw.current_amp > 25 && engineered.rpm < 100",
    "severity": "CRITICAL",
    "enabled": true
  }'
```

### Monitoring Energy Costs

```bash
# Get real-time energy metrics
curl http://localhost:8080/api/energy/metrics/motor_1

# Get cost optimization potential
curl http://localhost:8080/api/energy/savings/motor_1
```

### Predictive Maintenance

```bash
# Check maintenance status
curl http://localhost:8080/api/maintenance/recommendations/motor_1

# Log maintenance action
curl -X POST http://localhost:8080/api/maintenance/log/motor_1 \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "bearing_replacement",
    "notes": "Replaced worn bearings, next check in 30 days"
  }'
```

---

## Data Integration

All features integrate with the existing MongoDB collections:

| Collection | Purpose |
|-----------|---------|
| `telemetry` | Raw and engineered sensor data |
| `alerts` | AI-predicted abnormal states |
| `alert_rules` | Custom rule definitions |
| `rule_alerts` | Triggered custom alerts |
| `model_eval` | Model evaluation metrics |
| `maintenance_log` | Maintenance history |
| `maintenance_schedule` | Scheduled maintenance items |

---

## Configuration

### Update Cost/Carbon Settings

Edit `backend/src/services/energyMetricsService.js`:
```javascript
const CARBON_INTENSITY = 0.233; // kg CO2 per kWh
const POWER_COST = 0.12;        // $ per kWh
```

### Adjust Health Score Weights

Edit `backend/src/services/healthScoreService.js` to modify:
- State distribution weight (default 40%)
- Temperature stability weight (default 20%)
- Vibration trend weight (default 20%)
- Confidence weight (default 20%)

---

## WebSocket Events

Real-time updates broadcast to connected clients:

```javascript
// Health update
{ type: "health_update", data: { motor_id, score, status } }

// Anomaly detected
{ type: "anomaly", data: { motor_id, feature, z_score, severity } }

// Rule alert triggered
{ type: "rule_alert", data: { motor_id, rule_name, severity } }

// Maintenance alert
{ type: "maintenance_alert", data: { motor_id, risk_level } }
```

---

## Performance Metrics

The system is designed for scalability:
- Health score calculation: <100ms per motor
- Anomaly detection: <200ms per motor
- Energy metrics: <150ms per motor
- Predictive analysis: <300ms per motor
- Alert rules evaluation: <50ms per telemetry record

---

## Future Enhancements

Potential additions:
- Machine learning model retraining pipeline
- Multi-motor comparison analytics
- Data export/reporting system
- Email/SMS notifications
- Historical trend forecasting (ARIMA/Prophet)
- IoT edge deployment support
- REST API authentication/authorization

---

## Best Practices

1. **Set Up Multiple Rules** - Create both early-warning and critical alerts
2. **Monitor Trends** - Check health history weekly for patterns
3. **Act on Predictions** - Schedule maintenance before failures
4. **Track Costs** - Use energy metrics to identify efficiency opportunities
5. **Validate Anomalies** - Not all anomalies are failures; some are normal variations

---

**Version:** 1.0.0
**Last Updated:** April 30, 2024
