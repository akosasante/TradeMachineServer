# Prometheus Metrics Implementation Plan

## Overview
This document outlines a plan to implement Prometheus metrics collection in our TradeMachine application and visualization with Grafana. Metrics will provide insights into application performance, usage patterns, and health indicators.

## Completed Work

### ✅ Prometheus Client Library Setup
- Added `prom-client` and `express-prom-bundle` packages
- Created metrics initialization module at `src/bootstrap/metrics.ts`
- Implemented metrics registry and default metrics collection
- Created Express middleware for metrics collection

### ✅ HTTP Metrics via express-prom-bundle
- Request count
- Request duration
- Response size
- HTTP status codes

### ✅ Metrics Endpoint
- Added dedicated `/metrics` endpoint via `MetricsController.ts`
- Endpoint properly serves Prometheus-formatted metrics
- Modified to include Prisma metrics

### ✅ Job Queue Metrics
- Implemented comprehensive job metrics in `src/scheduled_jobs/metrics.ts`
- Added monitoring for email and Slack queues
- Tracking:
  - Active, completed, failed, waiting, delayed jobs
  - Job durations and waiting times
  - Job attempt counts
  - Queue errors and stalled jobs

### ✅ User Session Tracking
- Added `activeUserMetric` gauge in `src/bootstrap/metrics.ts`
- Integration with authentication system to track active sessions

### ✅ Database Performance Metrics
- Added Prisma metrics integration in MetricsController
- Prisma provides built-in metrics for query performance

### ✅ Graceful Shutdown
- Added shutdown handler for metrics intervals

### ✅ Prometheus Server Setup
- Successfully set up and tested in production

## Remaining Work

## 1. Grafana Dashboard Configuration

### System Dashboard
- System memory usage
- CPU utilization
- Node.js event loop lag
- Garbage collection duration

### HTTP Traffic Dashboard
- Request rate by endpoint
- Response time distributions
- Error rates
- Status code distribution

### Database Performance Dashboard
- Query execution time metrics from Prisma
- Connection pool statistics

### Job Queue Dashboard
- Job processing rates and times
- Queue sizes
- Error rates

Example Grafana dashboard configuration:

```json
{
  "dashboard": {
    "id": null,
    "uid": "trade-machine-system-metrics",
    "title": "TradeMachine System Metrics",
    "tags": ["nodejs", "trade-machine"],
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 1,
    "refresh": "10s",
    "panels": [
      {
        "title": "Memory Usage",
        "type": "graph",
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 0
        },
        "targets": [
          {
            "expr": "process_resident_memory_bytes{app=\"trade_machine\"}",
            "legendFormat": "Memory"
          }
        ],
        "yaxes": [
          {
            "format": "bytes"
          },
          {
            "show": false
          }
        ]
      },
      {
        "title": "CPU Usage",
        "type": "graph",
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 0
        },
        "targets": [
          {
            "expr": "rate(process_cpu_seconds_total{app=\"trade_machine\"}[1m])",
            "legendFormat": "CPU"
          }
        ],
        "yaxes": [
          {
            "format": "percentunit",
            "max": 1
          },
          {
            "show": false
          }
        ]
      },
      {
        "title": "HTTP Request Rate",
        "type": "graph",
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 8
        },
        "targets": [
          {
            "expr": "sum(rate(http_request_duration_seconds_count{app=\"trade_machine\"}[1m])) by (status_code, method, path)",
            "legendFormat": "{{method}} {{path}} ({{status_code}})"
          }
        ]
      },
      {
        "title": "Job Queue Size",
        "type": "graph",
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 8
        },
        "targets": [
          {
            "expr": "jobs_active_total{app=\"trade_machine\"}",
            "legendFormat": "Active {{queue_name}}"
          },
          {
            "expr": "jobs_waiting_total{app=\"trade_machine\"}",
            "legendFormat": "Waiting {{queue_name}}"
          },
          {
            "expr": "jobs_delayed_total{app=\"trade_machine\"}",
            "legendFormat": "Delayed {{queue_name}}"
          }
        ]
      },
      {
        "title": "Active User Sessions",
        "type": "gauge",
        "gridPos": {
          "h": 8,
          "w": 8,
          "x": 0,
          "y": 16
        },
        "targets": [
          {
            "expr": "trade_machine_active_sessions"
          }
        ],
        "options": {
          "minValue": 0,
          "maxValue": 100,
          "showThresholdLabels": false,
          "showThresholdMarkers": true,
          "thresholds": [
            {
              "color": "green",
              "value": null
            },
            {
              "color": "yellow",
              "value": 30
            },
            {
              "color": "red",
              "value": 80
            }
          ]
        }
      }
    ]
  }
}
```

## 2. Testing Strategy

### Integration Tests
Test that metrics endpoint returns expected data including Prisma metrics:

```typescript
describe('Metrics Endpoint', () => {
  it('should expose metrics in Prometheus format with Prisma metrics', async () => {
    const response = await request(app).get('/metrics');
    
    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(response.text).toContain('trade_machine_active_sessions');
    expect(response.text).toContain('prisma_');  // Prisma metrics prefix
  });
});
```

## 3. Future Enhancements

- Add alerting rules in Prometheus
- Create anomaly detection for key metrics
- Implement distributed tracing with OpenTelemetry
- Add business intelligence dashboards for league activity trends