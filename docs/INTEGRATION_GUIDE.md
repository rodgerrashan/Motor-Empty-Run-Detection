# Integration Guide - Adding Innovations to Your Project

This guide walks through integrating all the new innovative features into your existing Motor Empty-Run Detection system.

## File Structure

After adding all features, your backend structure should look like:

```
backend/src/
├── services/
│   ├── evaluationService.js          (existing)
│   ├── telemetryService.js           (updated)
│   ├── healthScoreService.js         (NEW)
│   ├── anomalyDetectionService.js    (NEW)
│   ├── energyMetricsService.js       (NEW)
│   ├── predictiveMaintenanceService.js (NEW)
│   └── alertRulesEngine.js           (NEW)
├── api/
│   └── routes.js                     (updated with new endpoints)
├── ml/
│   ├── featureEngineering.js         (existing)
│   └── onnxService.js                (existing)
├── mqtt/
│   └── subscriber.js                 (existing)
├── db/
│   └── mongo.js                      (may need index updates)
├── realtime/
│   └── wsHub.js                      (existing)
├── config.js
├── logger.js
└── index.js
```

## Database Collections

The new features require these additional MongoDB collections (auto-created):

```javascript
// Alert Rules
db.createCollection("alert_rules")
db.alert_rules.createIndex({ motor_id: 1 })
db.alert_rules.createIndex({ created_at: 1 })

// Rule Alerts (with TTL cleanup after 90 days)
db.createCollection("rule_alerts")
db.rule_alerts.createIndex({ motor_id: 1 })
db.rule_alerts.createIndex({ created_at: 1 })
db.rule_alerts.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 })

// Maintenance Logs
db.createCollection("maintenance_log")
db.maintenance_log.createIndex({ motor_id: 1 })
db.maintenance_log.createIndex({ timestamp: 1 })

// Maintenance Schedule
db.createCollection("maintenance_schedule")
db.maintenance_schedule.createIndex({ motor_id: 1 })
db.maintenance_schedule.createIndex({ scheduled_next_check: 1 })
```

## Update backend/src/db/mongo.js

Add index creation for new collections:

```javascript
export async function connectMongo() {
  // ... existing code ...
  
  const db = getDb();
  
  // Existing indices
  await db.collection("telemetry").createIndex({ motor_id: 1 });
  await db.collection("telemetry").createIndex({ event_time: 1 });
  await db.collection("alerts").createIndex({ motor_id: 1 });
  
  // NEW: Rule-related indices
  await db.collection("alert_rules").createIndex({ motor_id: 1 });
  await db.collection("alert_rules").createIndex({ enabled: 1 });
  await db.collection("rule_alerts").createIndex({ motor_id: 1 });
  await db.collection("rule_alerts").createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 });
  
  // NEW: Maintenance indices
  await db.collection("maintenance_log").createIndex({ motor_id: 1 });
  await db.collection("maintenance_schedule").createIndex({ motor_id: 1 });
}
```

## Update backend/package.json

Ensure these dependencies are present (they should be):

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongodb": "^6.0.0",
    "onnxruntime-node": "^1.16.0",
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "eslint": "^8.48.0"
  }
}
```

No new dependencies are required! All features use built-in Node.js modules and existing packages.

## Verify All Services Are Exported

Update backend/src/index.js to ensure all imports work correctly:

```javascript
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
    logger.info("Available endpoints:");
    logger.info("  Health: GET /api/health/score/:motorId");
    logger.info("  Anomalies: GET /api/anomalies/detect/:motorId");
    logger.info("  Energy: GET /api/energy/metrics/:motorId");
    logger.info("  Maintenance: GET /api/maintenance/recommendations/:motorId");
    logger.info("  Rules: GET /api/rules/:motorId");
    logger.info("  WebSocket: ws://localhost:" + config.port + "/ws");
  });
}

// Graceful shutdown
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
```

## Frontend Integration

### Update frontend/package.json

Ensure echarts is installed:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "echarts-for-react": "^3.0.2",
    "axios": "^1.5.0"
  }
}
```

### Update frontend/src/main.jsx

```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import EnhancedDashboard from './EnhancedDashboard'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EnhancedDashboard />
  </React.StrictMode>,
)
```

### Vite Configuration

frontend/vite.config.js should include:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  }
})
```

## Testing the New Features

### 1. Start the System

```bash
docker-compose up -d
```

### 2. Wait for Services to Be Ready

```bash
# Check backend logs
docker logs motor-backend

# Should see all endpoints listed
```

### 3. Test Health Score Endpoint

```bash
curl http://localhost:8080/api/health/score/motor_1
```

### 4. Test Anomaly Detection

```bash
curl http://localhost:8080/api/anomalies/detect/motor_1
```

### 5. Test Energy Metrics

```bash
curl http://localhost:8080/api/energy/metrics/motor_1
```

### 6. Create a Custom Alert Rule

```bash
curl -X POST http://localhost:8080/api/rules/motor_1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Temperature Warning",
    "condition": "raw.temperature_c > 70",
    "severity": "WARNING",
    "enabled": true
  }'
```

### 7. Get Rule Templates

```bash
curl http://localhost:8080/api/rules/templates
```

### 8. Monitor Maintenance Recommendations

```bash
curl http://localhost:8080/api/maintenance/recommendations/motor_1
```

## Docker Update (Optional)

Update backend/Dockerfile if needed to ensure all files are copied:

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080
CMD ["node", "src/index.js"]
```

## Troubleshooting

### Issue: "Cannot find module" errors

**Solution:** Ensure all service files are created in the correct location:
- `backend/src/services/` directory exists
- Files have `.js` extension
- Import statements use relative paths with `./`

### Issue: MongoDB collection errors

**Solution:** Check that MongoDB TTL indices are created:

```bash
# Connect to MongoDB
docker exec -it motor-mongodb mongosh

# Check indices
db.rule_alerts.getIndexes()

# Should show expireAfterSeconds: 7776000
```

### Issue: WebSocket connection fails

**Solution:** Ensure VITE_WS_URL is set correctly in frontend:

```javascript
// frontend/src/EnhancedDashboard.jsx
const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";
console.log("WebSocket URL:", wsUrl);
```

### Issue: Anomaly detection returns empty

**Solution:** Ensure sufficient telemetry data exists (minimum 5 samples required)

## Performance Optimization

### For High-Frequency Monitoring

If you have many motors, consider:

1. **Batch evaluation** - Process multiple motors in parallel
2. **Caching** - Cache health scores for 30 seconds
3. **Index optimization** - Add compound indices:

```javascript
db.telemetry.createIndex({ motor_id: 1, event_time: -1 })
db.rule_alerts.createIndex({ motor_id: 1, severity: 1 })
```

### Memory Management

For large datasets, limit analysis windows:

```javascript
// Reduce window size for high-traffic motors
const windowMinutes = motorId.endsWith('_high_traffic') ? 60 : 1440;
```

## Next Steps

1.  Deploy and test all endpoints
2.  Create custom alert rules for your use cases
3.  Set up monitoring dashboards
4.  Configure email/SMS notifications (future enhancement)
5.  Train team on new features
6.  Document SLAs and maintenance procedures

---

**Setup Time:** ~15 minutes
**Verification Time:** ~10 minutes
**Total:** ~25 minutes

For questions or issues, check the [INNOVATIONS.md](INNOVATIONS.md) and [API_REFERENCE.md](API_REFERENCE.md) files.
