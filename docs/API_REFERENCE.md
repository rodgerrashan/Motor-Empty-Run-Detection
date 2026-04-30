# API Reference - Enhanced Motor Monitoring System

## Base URL
```
http://localhost:8080
```

## Authentication
Currently no authentication required. Future versions should implement JWT/API keys.

---

## Health Score API

### Get Current Health Score
```
GET /api/health/score/{motorId}
Query Parameters:
  - window (optional): Time window in minutes (default: 60)

Example:
GET /api/health/score/motor_1?window=120

Response:
{
  "score": 87,
  "window_minutes": 60,
  "sample_count": 150,
  "state_distribution": {
    "NORMAL": 145,
    "OFF": 5
  },
  "details": {
    "state_score": 95.2,
    "temp_variability": 0.08,
    "vib_variability": 0.12,
    "avg_confidence": 0.96
  }
}
```

### Get Health History
```
GET /api/health/history/{motorId}
Query Parameters:
  - hours (optional): Lookback period in hours (default: 24)
  - interval (optional): Sampling interval in minutes (default: 30)

Example:
GET /api/health/history/motor_1?hours=48&interval=60

Response:
{
  "motor_id": "motor_1",
  "history": [
    {
      "timestamp": "2024-04-29T10:00:00Z",
      "score": 82,
      "status": "GOOD"
    },
    ...
  ]
}
```

### Get Health Status
```
GET /api/health/status/{motorId}

Response:
{
  "motor_id": "motor_1",
  "score": 87,
  "status": "EXCELLENT"
}
```

---

## Anomaly Detection API

### Detect Anomalies
```
GET /api/anomalies/detect/{motorId}
Query Parameters:
  - window (optional): Time window in minutes (default: 120)

Response:
{
  "motor_id": "motor_1",
  "anomaly_count": 3,
  "window_minutes": 120,
  "sample_count": 240,
  "anomalies": [
    {
      "timestamp": "2024-04-30T10:15:00Z",
      "feature": "temperature_c",
      "value": 92,
      "mean": 65.3,
      "stdDev": 8.5,
      "z_score": 3.15,
      "deviation_percent": 41.0,
      "method": "Z-SCORE",
      "severity": "HIGH"
    }
  ]
}
```

### Detect Sudden Changes
```
GET /api/anomalies/changes/{motorId}
Query Parameters:
  - window (optional): Time window in minutes (default: 60)
  - threshold (optional): Change threshold in percent (default: 20)

Response:
{
  "motor_id": "motor_1",
  "change_count": 2,
  "changes": [
    {
      "timestamp": "2024-04-30T10:15:00Z",
      "feature": "vibration_hz",
      "previous_value": 45.2,
      "current_value": 62.8,
      "change_percent": 38.9,
      "direction": "UP"
    }
  ]
}
```

### Get Anomaly Trends
```
GET /api/anomalies/trends/{motorId}
Query Parameters:
  - interval (optional): Interval in hours (default: 1)
  - lookback (optional): Lookback period in hours (default: 24)

Response:
{
  "motor_id": "motor_1",
  "trends": [
    {
      "hour": 0,
      "timestamp": "2024-04-30T10:00:00Z",
      "anomaly_count": 2,
      "severity_distribution": {
        "HIGH": 1,
        "MEDIUM": 1,
        "LOW": 0
      }
    }
  ]
}
```

---

## Energy Metrics API

### Get Energy Metrics
```
GET /api/energy/metrics/{motorId}
Query Parameters:
  - window (optional): Time window in minutes (default: 60)

Response:
{
  "motor_id": "motor_1",
  "energy": {
    "total_kwh": 1.25,
    "avg_power_kw": 1.25,
    "avg_current_amp": 5.4,
    "avg_power_factor": 0.92
  },
  "cost": {
    "estimated_usd": 0.15,
    "rate_usd_per_kwh": 0.12
  },
  "emissions": {
    "carbon_kg": 0.291,
    "carbon_intensity_kg_per_kwh": 0.233,
    "equivalent_tree_hours": 12.1
  },
  "efficiency": {
    "score": 88.5,
    "rating": "EXCELLENT"
  }
}
```

### Get Energy Trends
```
GET /api/energy/trends/{motorId}
Query Parameters:
  - interval (optional): Interval in hours (default: 1)
  - lookback (optional): Lookback period in hours (default: 24)

Response:
{
  "motor_id": "motor_1",
  "trends": [
    {
      "hour": 0,
      "timestamp": "2024-04-30T10:00:00Z",
      "energy_kwh": 1.25,
      "avg_power_kw": 1.25,
      "sample_count": 30,
      "cost_usd": 0.15,
      "carbon_kg": 0.291
    }
  ]
}
```

### Get Energy Optimization
```
GET /api/energy/optimization/{motorId}
Query Parameters:
  - window (optional): Time window in minutes (default: 1440)

Response includes current metrics + improvement analysis:
{
  "improvement": {
    "percent": 5.2,
    "direction": "IMPROVED",
    "historical_avg_power_kw": 1.32
  }
}
```

### Get Cost Savings Potential
```
GET /api/energy/savings/{motorId}

Response:
{
  "current_efficiency_score": 88.5,
  "current_cost": 0.15,
  "potential_cost_optimized": 0.14,
  "immediate_savings_potential": 0.01,
  "annualized_savings": 3.65,
  "carbon_reduction_kg": 2.33,
  "recommendations": [
    "Consider motor maintenance - efficiency has degraded"
  ]
}
```

---

## Predictive Maintenance API

### Get Degradation Trends
```
GET /api/maintenance/trends/{motorId}
Query Parameters:
  - hours (optional): Analysis window in hours (default: 168)

Response:
{
  "motor_id": "motor_1",
  "risk_score": 72,
  "risk_level": "HIGH",
  "risk_factors": [
    "Temperature increasing at 0.35°C/hour",
    "Vibration increasing at 0.85 Hz/hour"
  ],
  "trends": {
    "temperature": {
      "current": 72.5,
      "trend_per_hour": 0.35,
      "forecast_24h": [73.0, 73.35, ..., 82.5]
    }
  },
  "predicted_failure": {
    "predicted": true,
    "critical_factor": "temperature",
    "hours_to_maintenance": 42.5,
    "maintenance_date": "2024-05-01T04:30:00Z"
  }
}
```

### Get Maintenance Recommendations
```
GET /api/maintenance/recommendations/{motorId}

Response:
{
  "motor_id": "motor_1",
  "risk_level": "HIGH",
  "recommendations": [
    {
      "priority": "URGENT",
      "action": "Schedule maintenance within 2 days",
      "reason": "Temperature approaching critical threshold",
      "predicted_date": "2024-05-01T04:30:00Z"
    },
    {
      "priority": "HIGH",
      "action": "Check cooling system and ventilation",
      "reason": "Temperature trending upward"
    }
  ]
}
```

### Get Maintenance Schedule
```
GET /api/maintenance/schedule/{motorId}

Response:
{
  "motor_id": "motor_1",
  "scheduled_maintenance": [
    {
      "_id": "...",
      "action_type": "bearing_inspection",
      "timestamp": "2024-04-30T14:30:00Z",
      "scheduled_next_check": "2024-05-07T14:30:00Z"
    }
  ],
  "total_count": 3
}
```

### Log Maintenance Action
```
POST /api/maintenance/log/{motorId}
Content-Type: application/json

Body:
{
  "actionType": "bearing_replacement",
  "notes": "Replaced worn bearings, next check in 30 days"
}

Response:
{
  "success": true,
  "maintenance_id": "...",
  "message": "Maintenance action logged: bearing_replacement"
}
```

---

## Alert Rules API

### Get Rule Templates
```
GET /api/rules/templates

Response:
{
  "templates": [
    {
      "template_id": "TEMPERATURE_HIGH",
      "name": "High Temperature Alert",
      "condition": "raw.temperature_c > 75",
      "description": "Triggers when motor temperature exceeds 75°C",
      "severity": "WARNING"
    },
    ...
  ]
}
```

### Create Alert Rule
```
POST /api/rules/{motorId}
Content-Type: application/json

Body:
{
  "name": "Custom Rule Name",
  "description": "Rule description",
  "condition": "raw.temperature_c > 80 && raw.vibration_hz > 50",
  "severity": "WARNING",
  "enabled": true
}

Response:
{
  "success": true,
  "rule_id": "...",
  "message": "Alert rule created successfully"
}
```

### Get All Rules
```
GET /api/rules/{motorId}

Response:
{
  "motor_id": "motor_1",
  "total_rules": 5,
  "rules": [
    {
      "_id": "...",
      "name": "High Temperature",
      "condition": "raw.temperature_c > 75",
      "severity": "WARNING",
      "enabled": true,
      "trigger_count": 12,
      "last_triggered": "2024-04-30T10:15:00Z"
    }
  ],
  "templates": [...]
}
```

### Update Alert Rule
```
PUT /api/rules/{motorId}/{ruleId}
Content-Type: application/json

Body: (any of the rule fields to update)
{
  "condition": "raw.temperature_c > 82",
  "severity": "CRITICAL"
}

Response:
{
  "success": true,
  "message": "Rule updated successfully"
}
```

### Delete Alert Rule
```
DELETE /api/rules/{motorId}/{ruleId}

Response:
{
  "success": true,
  "message": "Rule deleted successfully"
}
```

### Get Rule Alerts History
```
GET /api/rules/{motorId}/alerts/history
Query Parameters:
  - limit (optional): Number of alerts (default: 100)
  - hours (optional): Lookback period (default: 24)

Response:
{
  "motor_id": "motor_1",
  "total_alerts": 45,
  "lookback_hours": 24,
  "alerts": [
    {
      "_id": "...",
      "rule_name": "High Temperature",
      "severity": "WARNING",
      "created_at": "2024-04-30T10:15:00Z",
      "message": "High Temperature Alert: Temperature: 78.5°C"
    }
  ]
}
```

### Get Rule Statistics
```
GET /api/rules/{motorId}/statistics

Response:
{
  "motor_id": "motor_1",
  "total_rules": 5,
  "enabled_rules": 4,
  "disabled_rules": 1,
  "top_triggered": [
    {
      "name": "High Temperature",
      "trigger_count": 145,
      "last_triggered": "2024-04-30T10:15:00Z"
    }
  ]
}
```

---

## WebSocket Events

Connect to `/ws` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  // Health update
  if (message.type === 'health_update') {
    console.log('Health:', message.data.score);
  }
  
  // Anomaly detected
  if (message.type === 'anomaly') {
    console.log('Anomaly:', message.data.feature);
  }
  
  // Rule alert triggered
  if (message.type === 'rule_alert') {
    console.log('Rule alert:', message.data.rule_name);
  }
};
```

---

## Error Responses

All errors follow this format:
```json
{
  "error": "Error description"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad request
- `404` - Not found
- `500` - Server error

---

## Rate Limiting

Currently no rate limiting implemented. Future versions should implement:
- 1000 requests per minute per IP
- 100 concurrent WebSocket connections per server

---

## Pagination

All list endpoints support:
- `limit` - Number of results (default: varies by endpoint)
- `offset` - Skip N results (not yet implemented)

---

**API Version:** 1.0.0
**Last Updated:** April 30, 2024
