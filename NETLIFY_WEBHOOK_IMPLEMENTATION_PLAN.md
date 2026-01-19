# Netlify Webhook to Discord Notifications Implementation Plan

## Overview
Implement a complete pipeline: Netlify deploy events → TradeMachineServer webhook → Prometheus metrics → Grafana alerts → Discord notifications

## Architecture Flow
```
Netlify Deploy Event
    ↓ (HTTP POST webhook)
TradeMachineServer /webhooks/netlify
    ↓ (emit Prometheus metrics)
Prometheus (scrapes /metrics endpoint)
    ↓ (query metrics)
Grafana Alert Rules
    ↓ (trigger on deploy failures)
Discord Webhook
```

## Implementation Steps

### 1. Server-Side Changes

#### A. Add Netlify Deployment Metrics (`src/bootstrap/metrics.ts`)
```typescript
// Add to existing metrics.ts file
export const netlifyDeploymentMetrics = (() => {
    const deploymentsTotal = new promClient.Counter({
        name: "netlify_deployments_total",
        help: "Total number of Netlify deployments",
        labelNames: ["state", "branch", "context"],
        registers: [metricsRegistry],
    });

    const deploymentDuration = new promClient.Histogram({
        name: "netlify_deployment_duration_seconds",
        help: "Netlify deployment duration in seconds",
        labelNames: ["branch", "context"],
        buckets: [10, 30, 60, 120, 300, 600, 1200],
        registers: [metricsRegistry],
    });

    const deploymentFailures = new promClient.Counter({
        name: "netlify_deployment_failures_total",
        help: "Total number of failed Netlify deployments",
        labelNames: ["branch", "context", "error"],
        registers: [metricsRegistry],
    });

    const currentDeploymentStatus = new promClient.Gauge({
        name: "netlify_current_deployment_status",
        help: "Current deployment status (1=building, 2=ready, -1=error, 0=stopped)",
        labelNames: ["branch", "context"],
        registers: [metricsRegistry],
    });

    return {
        deploymentsTotal,
        deploymentDuration,
        deploymentFailures,
        currentDeploymentStatus,
    };
})();
```

#### B. Create Webhook Controller (`src/api/routes/WebhookController.ts`)

**Key Features:**
- Accept Netlify webhook payload
- Validate webhook signature (optional but recommended)
- Emit appropriate Prometheus metrics based on deployment state
- Return proper HTTP responses
- Handle errors gracefully

**Metrics to Track:**
- Total deployments by state (building/ready/error/stopped)
- Deployment duration for successful builds
- Deployment failures with error classification
- Current deployment status as gauge

#### C. Netlify Webhook Payload Interface
```typescript
interface NetlifyWebhookPayload {
    id: string;
    site_id: string;
    build_id: string;
    state: "building" | "ready" | "error" | "stopped";
    name: string;
    branch: string;
    deploy_time?: number;
    error_message?: string;
    context: string;
    commit_ref: string;
    // ... other Netlify fields
}
```

### 2. Netlify Configuration

#### A. Add Webhook in Netlify Dashboard
1. Go to Site Settings → Build & Deploy → Deploy notifications
2. Add webhook: `https://yourdomain.com/webhooks/netlify`
3. Select events: Deploy started, Deploy succeeded, Deploy failed
4. Optional: Add shared secret for webhook verification

#### B. Webhook Events to Handle
- **Deploy started** (`building`): Increment building counter
- **Deploy succeeded** (`ready`): Increment success counter, record duration
- **Deploy failed** (`error`): Increment failure counter, track error details
- **Deploy stopped** (`stopped`): Handle manual stops

### 3. Grafana Configuration

#### A. Discord Webhook Setup
1. Create Discord webhook in target channel
2. Copy webhook URL
3. Configure in Grafana: Alerting → Contact Points
   ```
   Name: Discord - Deploy Notifications
   Type: Webhook
   URL: https://discord.com/api/webhooks/YOUR_WEBHOOK_URL
   HTTP Method: POST
   ```

#### B. Alert Rules Configuration

**Deploy Failure Alert:**
```promql
# Query: Rate of deployment failures in last 5 minutes
rate(netlify_deployment_failures_total[5m]) > 0

# Labels:
# - severity: critical
# - team: frontend

# Annotations:
# - summary: Netlify deployment failed
# - description: Branch {{ $labels.branch }} failed to deploy in {{ $labels.context }}
```

**Deploy Success Notification (Optional):**
```promql
# Query: Successful deployments to main branch
increase(netlify_deployments_total{state="ready",branch="main"}[1m]) > 0
```

**Long-Running Deployment Alert:**
```promql
# Query: Deployments taking longer than 10 minutes
netlify_current_deployment_status{state="building"} == 1
# For: 10m (alert if building for more than 10 minutes)
```

#### C. Notification Templates
```json
{
  "content": "🚨 **Deployment Alert**",
  "embeds": [
    {
      "title": "{{ .GroupLabels.alertname }}",
      "description": "{{ range .Alerts }}{{ .Annotations.description }}{{ end }}",
      "color": 15158332,
      "fields": [
        {
          "name": "Branch",
          "value": "{{ .GroupLabels.branch }}",
          "inline": true
        },
        {
          "name": "Context",
          "value": "{{ .GroupLabels.context }}",
          "inline": true
        }
      ],
      "timestamp": "{{ .CommonAnnotations.timestamp }}"
    }
  ]
}
```

### 4. Testing Strategy

#### A. Local Testing
1. Use ngrok to expose local server: `ngrok http 3001`
2. Configure Netlify webhook to ngrok URL
3. Trigger test deployments
4. Verify metrics appear in Prometheus
5. Test Grafana alerts manually

#### B. Webhook Testing Tools
- Use Postman/curl to send test payloads
- Netlify provides webhook testing in dashboard
- Monitor server logs for webhook processing

#### C. End-to-End Testing Checklist
- [ ] Webhook endpoint receives and processes Netlify payloads
- [ ] Metrics are emitted and scraped by Prometheus
- [ ] Grafana can query the new metrics
- [ ] Alert rules trigger correctly
- [ ] Discord notifications are sent and formatted properly

### 5. Deployment Considerations

#### A. Security
- Add webhook signature verification for production
- Rate limiting on webhook endpoint
- Input validation and sanitization
- Proper error handling and logging

#### B. Monitoring
- Add logging for webhook processing
- Monitor webhook endpoint performance
- Alert on webhook processing failures

#### C. Configuration Management
- Environment variables for Discord webhook URLs
- Different alert thresholds for staging vs production
- Branch-specific notification channels

### 6. Expected Metrics

After implementation, you'll have these queryable metrics:

```promql
# Total deployments by state
netlify_deployments_total{state="ready",branch="main"}

# Deployment failure rate
rate(netlify_deployment_failures_total[5m])

# Average deployment duration
histogram_quantile(0.95, netlify_deployment_duration_seconds_bucket)

# Currently building deployments
netlify_current_deployment_status{state="building"}
```

### 7. Grafana Dashboard Ideas

- **Deployment Overview**: Success/failure rates, deployment frequency
- **Performance**: Deployment duration trends, build time percentiles
- **Branch Health**: Per-branch deployment success rates
- **Timeline**: Deployment events with annotations on other metrics

## Implementation Timeline

1. **Day 1**: Add metrics infrastructure and webhook controller
2. **Day 2**: Configure Netlify webhooks and test locally
3. **Day 3**: Set up Grafana alerts and Discord integration
4. **Day 4**: End-to-end testing and refinement
5. **Day 5**: Deploy to production and monitor

## Notes

- This approach gives you both visibility (metrics/dashboards) AND notifications (Discord)
- Metrics are queryable for building custom dashboards and alerts
- Easy to extend for other webhook sources (GitHub Actions, etc.)
- Follows existing patterns in your TradeMachineServer codebase