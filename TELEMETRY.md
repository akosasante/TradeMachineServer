# TradeMachine Server - Distributed Tracing & Telemetry

This document covers the distributed tracing implementation in TradeMachine Server, which connects with the frontend Faro traces to provide end-to-end observability.

## 🔍 Overview

The server uses **OpenTelemetry** to instrument HTTP requests and business logic, sending traces to our monitoring stack (Grafana Alloy → Tempo → Grafana). This enables correlation between frontend user interactions and backend API calls.

### What's Implemented

- **W3C Trace Context**: Extracts `traceparent` and `tracestate` headers from frontend requests
- **Automatic HTTP/Express Instrumentation**: All HTTP requests get basic spans automatically
- **Manual Business Logic Tracing**: Detailed spans for authentication, database operations, and job queuing
- **Monitoring Stack Integration**: Traces flow through Alloy to Tempo and display in Grafana

## 🚀 How It Works

### Automatic Tracing (Zero Code Changes)

When the server starts, OpenTelemetry automatically instruments:

- **HTTP Requests**: Method, URL, status code, response time
- **Express Routes**: Route patterns and middleware execution
- **Database Queries**: (when using instrumented database clients)

Example automatic span: `GET /auth/login` with attributes like `http.method`, `http.status_code`.

### Manual Tracing (Business Logic)

For detailed business insights, manually add spans using our utility functions:

```typescript
import { createSpanFromRequest, finishSpanWithResponse, addSpanAttributes, addSpanEvent } from "../../utils/tracing";
import { context } from "@opentelemetry/api";

// In your controller method
const { span, context: traceContext } = createSpanFromRequest("auth.login", request);

try {
    return await context.with(traceContext, async () => {
        // Your business logic here
        addSpanAttributes({
            "user.id": userId,
            "auth.method": "session"
        });

        addSpanEvent("user.authenticated", { userId });

        // More business logic...

        finishSpanWithResponse(span, response);
        return result;
    });
} catch (error) {
    addSpanEvent("operation.error", { error: error.message });
    finishSpanWithResponse(span, response, error);
    throw error;
}
```

## 📁 File Structure

```
src/
├── bootstrap/
│   └── telemetry.ts          # OpenTelemetry SDK configuration and initialization
├── utils/
│   └── tracing.ts            # Utility functions for manual span management
├── server.ts                 # Early telemetry initialization (MUST be first import)
├── api/
│   ├── middlewares/
│   │   └── ErrorHandler.ts   # Global error handler with automatic span error recording
│   └── routes/
│       └── AuthController.ts # Example implementation with tracing
```

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# OpenTelemetry Tracing Configuration
OTEL_SERVICE_NAME=trademachine-server
OTEL_SERVICE_VERSION=2.0.1
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_RESOURCE_ATTRIBUTES="service.name=trademachine-server,service.version=2.0.1"

# Optional: Control trace sampling (1.0 = 100%, 0.1 = 10%)
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0
```

### Monitoring Stack

The traces flow through this pipeline:

1. **Backend (OpenTelemetry)** → localhost:4318 (OTLP HTTP)
2. **Alloy** (processes and forwards) → Tempo (gRPC)
3. **Tempo** (stores traces) → Grafana (displays)

Start the monitoring stack:
```bash
cd ~/dev/TradeMachine
docker-compose -f docker-compose.shared.yml --profile monitoring up -d
```

Access Grafana at http://localhost:3000 to view traces.

## 🛠️ Adding Tracing to New Endpoints

### Step 1: Import Utilities

```typescript
import { createSpanFromRequest, finishSpanWithResponse, addSpanAttributes, addSpanEvent } from "../../utils/tracing";
import { context } from "@opentelemetry/api";
```

### Step 2: Wrap Your Method

```typescript
@Post("/your-endpoint")
public async yourMethod(@Req() request: Request, @Res() response: Response): Promise<YourType> {
    const { span, context: traceContext } = createSpanFromRequest("your.operation", request);

    return await context.with(traceContext, async () => {
        // Your business logic here

        // Add relevant attributes
        addSpanAttributes({
            "business.entity": entityType,
            "operation.type": "create"
        });

        // Add events for key moments
        addSpanEvent("validation.start");
        // ... validation logic
        addSpanEvent("validation.complete");

        addSpanEvent("database.operation.start");
        const result = await this.dao.create(data);
        addSpanEvent("database.operation.complete");

        // Finish span with response on success
        finishSpanWithResponse(span, response);
        return result;
    });
    // No try/catch needed! Global error handler in ErrorHandler.ts automatically:
    // - Records exceptions in active spans
    // - Sets error status on spans
    // - Handles HTTP error responses
}
```

### Step 3: Add Meaningful Attributes and Events

Choose attributes and events that help with debugging and performance analysis:

**Attributes** (metadata for the entire span):
- `user.id`, `user.is_admin`
- `business.entity.type`, `business.entity.id`
- `database.table`, `database.operation`
- `external.service`, `external.endpoint`

**Events** (timestamped moments within the span):
- `validation.start`, `validation.complete`
- `database.query.start`, `database.query.complete`
- `external.api.call`, `external.api.response`
- `error.occurred`, `retry.attempt`

## 📊 Current Implementation Status

### ✅ Implemented Endpoints

- **POST /auth/login**: User authentication with session management
- **POST /auth/login/sendResetEmailOban**: Password reset via Oban job queue

### 🔄 Automatic Instrumentation

All endpoints automatically get basic HTTP tracing including:
- Request method, URL, headers
- Response status code, duration
- User agent, correlation with frontend traces

### 🎯 Future Endpoint Candidates

Consider adding detailed tracing to:
- Trade creation and approval workflows
- User registration and profile management
- Data import/export operations
- External API integrations (ESPN, email services)

## 🔍 Viewing Traces

### Grafana (http://localhost:3000)

1. Navigate to **Explore**
2. Select **Tempo** as data source
3. Search for traces by:
   - Service name: `trademachine-server`
   - Operation: `auth.login`, `auth.sendResetEmailOban`
   - User ID or other attributes

### Trace Correlation

When the frontend makes API calls:
1. Frontend Faro generates trace context
2. Browser sends `traceparent` header with requests
3. Backend extracts context and creates child spans
4. Both frontend and backend spans appear in the same trace tree

## 🚨 Best Practices

### Do ✅

- **Initialize telemetry early**: Import `./bootstrap/telemetry` before other modules
- **Use semantic attributes**: Follow OpenTelemetry conventions (`user.id`, `http.method`)
- **Add business context**: Include domain-specific attributes (`trade.id`, `team.id`)
- **Handle errors properly**: Record exceptions and set error status
- **Sample in production**: Use `OTEL_TRACES_SAMPLER_ARG=0.1` for 10% sampling

### Don't ❌

- **Don't include sensitive data**: Avoid passwords, tokens, or PII in attributes
- **Don't over-instrument**: Focus on business-critical paths and error scenarios
- **Don't block on telemetry**: Telemetry failures shouldn't affect application functionality
- **Don't trace health checks**: Filter out `/health`, `/metrics` endpoints (already configured)

## 🐛 Troubleshooting

### Common Issues

**1. No traces appearing in Grafana**
- Verify monitoring stack is running: `docker-compose ps`
- Check Alloy logs: `docker-compose logs alloy`
- Confirm OTLP endpoint: `curl -v http://localhost:4318/v1/traces`

**2. Traces not correlated with frontend**
- Ensure frontend sends `traceparent` headers
- Verify W3C trace context extraction in `createSpanFromRequest`
- Check both services use same trace backend

**3. Performance impact**
- Reduce sampling rate in production: `OTEL_TRACES_SAMPLER_ARG=0.1`
- Monitor memory usage with heavy tracing
- Disable noisy instrumentations (already configured)

### Debug Mode

Enable verbose logging in `src/bootstrap/telemetry.ts`:

```typescript
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
```

## 📚 Resources

- [OpenTelemetry Node.js Documentation](https://opentelemetry.io/docs/instrumentation/js/)
- [W3C Trace Context Specification](https://www.w3.org/TR/trace-context/)
- [TradeMachine Monitoring Stack](../../monitoring/README.md)
- [Frontend Faro Integration](../../../TradeMachineClientV3/MONITORING.md)