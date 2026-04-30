# Complete Usage Examples & Scenarios

This document provides real-world examples and scenarios for using the enhanced monitoring system.

## Table of Contents
1. [Quick Test Scenarios](#quick-test-scenarios)
2. [Integration Examples](#integration-examples)
3. [Real-World Use Cases](#real-world-use-cases)
4. [Troubleshooting Scenarios](#troubleshooting-scenarios)
5. [Automation Scripts](#automation-scripts)

---

## Quick Test Scenarios

### Scenario 1: Complete Motor Monitoring in 2 Minutes

```bash
#!/bin/bash

MOTOR_ID="motor_1"
API="http://localhost:8080"

echo "=== Motor Health Check ==="
curl -s "$API/api/health/score/$MOTOR_ID" | jq .

echo -e "\n=== Energy Status ==="
curl -s "$API/api/energy/metrics/$MOTOR_ID" | jq '.energy, .cost'

echo -e "\n=== Anomaly Report ==="
curl -s "$API/api/anomalies/detect/$MOTOR_ID" | jq '.anomaly_count, .anomalies[0]'

echo -e "\n=== Maintenance Status ==="
curl -s "$API/api/maintenance/recommendations/$MOTOR_ID" | jq '.risk_level, .recommendations[0]'
```

### Scenario 2: Set Up Complete Monitoring Rules

```bash
#!/bin/bash

MOTOR_ID="motor_1"
API="http://localhost:8080"

# Get all available templates
echo "Available Rules:"
curl -s "$API/api/rules/templates" | jq '.templates[].template_id'

# Create 4 critical rules
RULES=(
  '{"name":"High Temp","condition":"raw.temperature_c > 75","severity":"WARNING"}'
  '{"name":"Critical Temp","condition":"raw.temperature_c > 85","severity":"CRITICAL"}'
  '{"name":"High Vibration","condition":"raw.vibration_hz > 100","severity":"WARNING"}'
  '{"name":"Motor Stalled","condition":"predicted_state === \"STALLED\"","severity":"CRITICAL"}'
)

for rule in "${RULES[@]}"; do
  echo "Creating rule..."
  curl -X POST "$API/api/rules/$MOTOR_ID" \
    -H "Content-Type: application/json" \
    -d "$rule" | jq '.'
  sleep 1
done
```

---

## Integration Examples

### Example 1: Python Client for Health Monitoring

```python
import requests
import json
from datetime import datetime

class MotorMonitor:
    def __init__(self, motor_id, api_base="http://localhost:8080"):
        self.motor_id = motor_id
        self.api_base = api_base
    
    def get_health_score(self):
        """Get current health score"""
        resp = requests.get(
            f"{self.api_base}/api/health/score/{self.motor_id}"
        )
        return resp.json()
    
    def get_anomalies(self):
        """Get detected anomalies"""
        resp = requests.get(
            f"{self.api_base}/api/anomalies/detect/{self.motor_id}"
        )
        return resp.json()
    
    def get_maintenance_status(self):
        """Get maintenance recommendations"""
        resp = requests.get(
            f"{self.api_base}/api/maintenance/recommendations/{self.motor_id}"
        )
        return resp.json()
    
    def create_alert_rule(self, name, condition, severity="WARNING"):
        """Create custom alert rule"""
        data = {
            "name": name,
            "condition": condition,
            "severity": severity,
            "enabled": True
        }
        resp = requests.post(
            f"{self.api_base}/api/rules/{self.motor_id}",
            json=data
        )
        return resp.json()
    
    def get_energy_report(self):
        """Get energy consumption report"""
        resp = requests.get(
            f"{self.api_base}/api/energy/metrics/{self.motor_id}"
        )
        data = resp.json()
        return {
            "energy_kwh": data.get("energy", {}).get("total_kwh"),
            "cost": data.get("cost", {}).get("estimated_usd"),
            "efficiency": data.get("efficiency", {}).get("score"),
            "carbon_kg": data.get("emissions", {}).get("carbon_kg")
        }
    
    def print_report(self):
        """Print comprehensive monitoring report"""
        print(f"\n{'='*50}")
        print(f"MOTOR MONITORING REPORT: {self.motor_id}")
        print(f"Time: {datetime.now().isoformat()}")
        print(f"{'='*50}\n")
        
        # Health Score
        health = self.get_health_score()
        print(f"🏥 Health Score: {health.get('score')}/100")
        print(f"   Sample Count: {health.get('sample_count')}\n")
        
        # Energy
        energy = self.get_energy_report()
        print(f"⚡ Energy Metrics:")
        print(f"   Consumption: {energy['energy_kwh']:.2f} kWh")
        print(f"   Cost: ${energy['cost']:.2f}")
        print(f"   Efficiency: {energy['efficiency']:.1f}%\n")
        
        # Anomalies
        anomalies = self.get_anomalies()
        print(f"🔍 Anomalies Detected: {anomalies.get('anomaly_count', 0)}")
        if anomalies.get('anomalies'):
            for anom in anomalies['anomalies'][:2]:
                print(f"   - {anom['feature']}: {anom['severity']}")
        print()
        
        # Maintenance
        maint = self.get_maintenance_status()
        print(f"🔧 Maintenance Status: {maint.get('risk_level')}")
        if maint.get('recommendations'):
            for rec in maint['recommendations'][:2]:
                print(f"   - {rec['action']}\n")

# Usage
if __name__ == "__main__":
    monitor = MotorMonitor("motor_1")
    monitor.print_report()
```

### Example 2: JavaScript WebSocket Listener

```javascript
// monitor.js
class MotorWebSocketMonitor {
  constructor(motorId, wsUrl = "ws://localhost:8080/ws") {
    this.motorId = motorId;
    this.wsUrl = wsUrl;
    this.alerts = [];
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log(" Connected to monitoring service");
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch(message.type) {
        case "telemetry":
          if (message.data.motor_id === this.motorId) {
            this.onTelemetry(message.data);
          }
          break;
        
        case "rule_alert":
          if (message.data.motor_id === this.motorId) {
            this.onAlert(message.data);
          }
          break;
        
        case "alert":
          if (message.data.motor_id === this.motorId) {
            this.onPredictionAlert(message.data);
          }
          break;
      }
    };

    this.ws.onerror = (error) => {
      console.error(" WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.log("Connection closed, reconnecting in 3s...");
      setTimeout(() => this.setupWebSocket(), 3000);
    };
  }

  onTelemetry(data) {
    const temp = data.raw.temperature_c;
    const vib = data.raw.vibration_hz;
    
    // Custom logic
    if (temp > 80) {
      console.warn(`  High temperature: ${temp}°C`);
    }
    if (vib > 100) {
      console.warn(`  High vibration: ${vib} Hz`);
    }
  }

  onAlert(data) {
    this.alerts.push({
      timestamp: new Date(),
      type: "rule_alert",
      rule: data.rule_name,
      severity: data.severity,
      message: data.message
    });
    
    console.error(` ALERT [${data.severity}]: ${data.rule_name}`);
    console.error(`   ${data.message}`);
  }

  onPredictionAlert(data) {
    console.error(` ANOMALY DETECTED: ${data.predicted_state}`);
    console.error(`   Confidence: ${(data.confidence * 100).toFixed(1)}%`);
  }

  getAlertsSince(minutesAgo = 60) {
    const cutoff = Date.now() - minutesAgo * 60 * 1000;
    return this.alerts.filter(a => a.timestamp.getTime() > cutoff);
  }

  printAlertSummary() {
    const recent = this.getAlertsSince(60);
    console.log(`\n Alerts in Last Hour: ${recent.length}`);
    recent.forEach(alert => {
      console.log(`  - [${alert.severity}] ${alert.rule}`);
    });
  }
}

// Usage
const monitor = new MotorWebSocketMonitor("motor_1");

// Print summary every 30 minutes
setInterval(() => monitor.printAlertSummary(), 30 * 60 * 1000);
```

---

## Real-World Use Cases

### Use Case 1: Predictive Maintenance for Factory

```bash
#!/bin/bash

# Monitor 10 motors and predict failures
MOTORS=("motor_1" "motor_2" "motor_3" "motor_4" "motor_5" "motor_6" "motor_7" "motor_8" "motor_9" "motor_10")
API="http://localhost:8080"

echo "🏭 Factory Maintenance Report"
echo "==============================\n"

CRITICAL_COUNT=0
URGENT_ACTIONS=""

for MOTOR in "${MOTORS[@]}"; do
  MAINTENANCE=$(curl -s "$API/api/maintenance/recommendations/$MOTOR" | jq '.risk_level')
  
  if [ "$MAINTENANCE" = '"CRITICAL"' ]; then
    CRITICAL_COUNT=$((CRITICAL_COUNT + 1))
    URGENT_ACTIONS+="$MOTOR: CRITICAL\n"
  fi
done

echo "Critical Alerts: $CRITICAL_COUNT / ${#MOTORS[@]}"
echo -e "Urgent Actions:\n$URGENT_ACTIONS"

# Send alert if critical
if [ $CRITICAL_COUNT -gt 0 ]; then
  echo "⚠️  SENDING ALERT TO MAINTENANCE TEAM"
  # Add email/SMS logic here
fi
```

### Use Case 2: Energy Cost Optimization

```python
import requests
from datetime import datetime, timedelta

class EnergyOptimizer:
    def __init__(self, motors, api_base="http://localhost:8080"):
        self.motors = motors
        self.api_base = api_base
    
    def get_all_costs(self):
        """Get cost breakdown for all motors"""
        total_cost = 0
        details = []
        
        for motor in self.motors:
            resp = requests.get(
                f"{self.api_base}/api/energy/metrics/{motor}"
            )
            data = resp.json()
            cost = data.get("cost", {}).get("estimated_usd", 0)
            total_cost += cost
            
            savings_resp = requests.get(
                f"{self.api_base}/api/energy/savings/{motor}"
            )
            savings_data = savings_resp.json()
            potential_savings = savings_data.get("immediate_savings_potential", 0)
            
            details.append({
                "motor": motor,
                "cost": cost,
                "potential_savings": potential_savings,
                "efficiency": savings_data.get("current_efficiency_score", 0)
            })
        
        return {
            "total_current_cost": total_cost,
            "total_potential_savings": sum(d["potential_savings"] for d in details),
            "motors": details
        }
    
    def print_optimization_report(self):
        """Print optimization opportunities"""
        data = self.get_all_costs()
        
        print("\n💰 ENERGY COST OPTIMIZATION REPORT")
        print("=" * 50)
        print(f"Current Monthly Cost: ${data['total_current_cost'] * 730:.2f}")
        print(f"Potential Monthly Savings: ${data['total_potential_savings'] * 730:.2f}")
        print(f"Potential Annual Savings: ${data['total_potential_savings'] * 730 * 12:.2f}\n")
        
        print("Motor Efficiency Rankings:")
        sorted_motors = sorted(data["motors"], 
                              key=lambda x: x["potential_savings"], 
                              reverse=True)
        
        for i, motor in enumerate(sorted_motors, 1):
            print(f"{i}. {motor['motor']}: {motor['efficiency']:.1f}% "
                  f"(Save ${motor['potential_savings']:.2f}/hour)")

# Usage
optimizer = EnergyOptimizer(["motor_1", "motor_2", "motor_3", "motor_4", "motor_5"])
optimizer.print_optimization_report()
```

### Use Case 3: SLA Compliance Monitoring

```javascript
// Check if all motors meet SLA requirements
async function checkSLACompliance() {
  const API = "http://localhost:8080";
  const motors = ["motor_1", "motor_2", "motor_3"];
  
  const SLA = {
    minHealthScore: 70,
    maxAnomalies: 5,
    maxRiskLevel: "MEDIUM"
  };
  
  let compliant = 0;
  let violations = [];
  
  for (const motor of motors) {
    let motorCompliant = true;
    const issues = [];
    
    // Check health
    const health = await fetch(`${API}/api/health/score/${motor}`).then(r => r.json());
    if (health.score < SLA.minHealthScore) {
      motorCompliant = false;
      issues.push(`Health: ${health.score} < ${SLA.minHealthScore}`);
    }
    
    // Check anomalies
    const anomalies = await fetch(`${API}/api/anomalies/detect/${motor}`).then(r => r.json());
    if (anomalies.anomaly_count > SLA.maxAnomalies) {
      motorCompliant = false;
      issues.push(`Anomalies: ${anomalies.anomaly_count} > ${SLA.maxAnomalies}`);
    }
    
    // Check maintenance
    const maint = await fetch(`${API}/api/maintenance/recommendations/${motor}`).then(r => r.json());
    const riskLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    if (riskLevels.indexOf(maint.risk_level) > riskLevels.indexOf(SLA.maxRiskLevel)) {
      motorCompliant = false;
      issues.push(`Risk: ${maint.risk_level} > ${SLA.maxRiskLevel}`);
    }
    
    if (motorCompliant) {
      compliant++;
    } else {
      violations.push({ motor, issues });
    }
  }
  
  console.log(`\n SLA COMPLIANCE REPORT`);
  console.log(`${compliant}/${motors.length} motors compliant`);
  
  if (violations.length > 0) {
    console.log(`\n Violations:`);
    violations.forEach(v => {
      console.log(`\n${v.motor}:`);
      v.issues.forEach(issue => console.log(`  - ${issue}`));
    });
  }
}

checkSLACompliance();
```

---

## Troubleshooting Scenarios

### Scenario: High false positive anomalies

```bash
# Check anomaly distribution
curl http://localhost:8080/api/anomalies/trends/motor_1?lookback=24 | jq '.trends'

# If too many, adjust Z-score threshold in anomalyDetectionService.js
# Current: > 3σ (99.7% confidence)
# Try: > 3.5σ for less sensitive detection
```

### Scenario: Health score not updating

```bash
# Check telemetry count
curl http://localhost:8080/api/telemetry/latest?motorId=motor_1&limit=1 | jq '.[-1].event_time'

# Check if data is recent (within last 60 minutes)
# If not, check MQTT subscriber logs

docker logs motor-backend | grep "MQTT"
```

### Scenario: Rules not triggering

```bash
# Verify rule syntax
curl http://localhost:8080/api/rules/motor_1 | jq '.rules[] | {name, condition}'

# Test condition manually
# Check raw telemetry values
curl http://localhost:8080/api/telemetry/latest?motorId=motor_1&limit=1 | jq '.[-1].raw'

# Verify rule is enabled
curl http://localhost:8080/api/rules/motor_1 | jq '.rules[] | select(.name=="High Temperature")'
```

---

## Automation Scripts

### Automated Maintenance Logging

```bash
#!/bin/bash

# Log maintenance action for a motor
log_maintenance() {
  MOTOR_ID=$1
  ACTION_TYPE=$2
  NOTES=$3
  API="http://localhost:8080"
  
  curl -X POST "$API/api/maintenance/log/$MOTOR_ID" \
    -H "Content-Type: application/json" \
    -d "{
      \"actionType\": \"$ACTION_TYPE\",
      \"notes\": \"$NOTES\"
    }"
}

# Usage
log_maintenance "motor_1" "bearing_inspection" "Bearings checked, temperature 65C, vibration normal. Next inspection in 30 days."
```

### Daily Health Report Generator

```python
import requests
from datetime import datetime
from email.mime.text import MIMEText

def generate_daily_report(motors, api_base="http://localhost:8080"):
    """Generate daily health report"""
    
    report = f"Daily Motor Health Report - {datetime.now().strftime('%Y-%m-%d')}\n"
    report += "=" * 60 + "\n\n"
    
    for motor in motors:
        health = requests.get(f"{api_base}/api/health/score/{motor}").json()
        maint = requests.get(f"{api_base}/api/maintenance/recommendations/{motor}").json()
        energy = requests.get(f"{api_base}/api/energy/metrics/{motor}").json()
        
        report += f"Motor: {motor}\n"
        report += f"  Health Score: {health.get('score')}/100\n"
        report += f"  Maintenance Risk: {maint.get('risk_level')}\n"
        report += f"  Energy Cost (last hour): ${energy.get('cost', {}).get('estimated_usd', 0):.2f}\n"
        report += "-" * 60 + "\n"
    
    return report

# Usage
report = generate_daily_report(["motor_1", "motor_2", "motor_3", "motor_4"])
print(report)

# Save to file
with open(f"motor_report_{datetime.now().strftime('%Y%m%d')}.txt", "w") as f:
    f.write(report)
```

---

## Summary

These examples cover:
-  Quick testing of all features
-  Integration with Python and JavaScript
-  Real-world use cases
-  Troubleshooting common issues
-  Automation scripts for daily tasks

For more information, see:
- [INNOVATIONS.md](INNOVATIONS.md) - Feature descriptions
- [API_REFERENCE.md](API_REFERENCE.md) - Complete API documentation
- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) - Setup instructions

