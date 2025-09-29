# Backend Distributed Tracing Implementation Guide

This document outlines the steps needed to implement distributed tracing on the TradeMachineServer backend to connect with the frontend Grafana Faro traces.

## Overview

The frontend has been updated to:
- ✅ Propagate trace context headers in HTTP requests via OpenTelemetry API
- ✅ Configure Faro with TracingInstrumentation for automatic fetch/XHR instrumentation
- ✅ Include trace context headers (`traceparent`, `tracestate`) in all API calls

## Backend Implementation Steps

### 1. Install Dependencies

```bash
cd TradeMachineServer
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

### 2. Create Telemetry Bootstrap

Create `/src/bootstrap/telemetry.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'trademachine-server',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Often too noisy
      },
      '@opentelemetry/instrumentation-net': {
        enabled: false, // Can be noisy
      },
    }),
  ],
});

// Start the SDK
sdk.start();
```

### 3. Initialize Tracing Early

In `/src/server.ts` (or main entry point), add at the very top:

```typescript
// MUST be first import to instrument other modules
import './bootstrap/telemetry';

// Rest of imports...
import express from 'express';
// ... other imports
```

### 4. Add Express Tracing Middleware

Create `/src/api/middlewares/TracingMiddleware.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { trace, context, propagation, SpanStatusCode } from '@opentelemetry/api';

export function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  // Extract trace context from incoming headers
  const activeContext = propagation.extract(context.active(), req.headers);

  // Start a new span for this request
  const tracer = trace.getTracer('trademachine-server');
  const span = tracer.startSpan(`${req.method} ${req.route?.path || req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path,
      'http.user_agent': req.get('User-Agent'),
      'user.id': (req as any).session?.userId?.toString(),
      'user.authenticated': !!(req as any).session?.userId,
    },
  }, activeContext);

  // Set span in context for downstream code
  const spanContext = trace.setSpan(context.active(), span);

  // Store context in request for use in controllers/DAOs
  (req as any).traceContext = spanContext;

  // Handle response completion
  res.on('finish', () => {
    span.setAttributes({
      'http.status_code': res.statusCode,
      'http.response.size': res.get('content-length') || 0,
    });

    // Set span status based on HTTP status code
    if (res.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${res.statusCode}`,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  });

  // Handle errors
  res.on('error', (error) => {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.end();
  });

  // Continue with the request in the trace context
  context.with(spanContext, () => {
    next();
  });
}
```

### 5. Register Middleware in Express App

In your main express app setup (likely `/src/bootstrap/app.ts` or `/src/server.ts`):

```typescript
import { tracingMiddleware } from './api/middlewares/TracingMiddleware';

// Add this AFTER routing-controllers setup but BEFORE route handlers
app.use(tracingMiddleware);
```

### 6. Optional: Enhance DAO Operations with Spans

For more detailed tracing, you can add spans to your DAO operations:

```typescript
// Example in a DAO method
import { trace, context } from '@opentelemetry/api';

async findUserById(id: string): Promise<User | null> {
  const tracer = trace.getTracer('trademachine-server');

  return await tracer.startActiveSpan('UserDAO.findById', async (span) => {
    span.setAttributes({
      'db.operation': 'findById',
      'db.table': 'users',
      'user.id': id,
    });

    try {
      const user = await this.userRepository.findById(id);
      span.setAttributes({
        'db.result.found': !!user,
      });
      return user;
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### 7. Configure Trace Export

You'll need to configure where traces are sent. Options include:

#### Option A: OTLP Exporter (Recommended)
```bash
npm install @opentelemetry/exporter-otlp-http
```

```typescript
// In telemetry.ts
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';

export const sdk = new NodeSDK({
  // ... existing config
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  }),
});
```

#### Option B: Console Exporter (Development)
```bash
npm install @opentelemetry/exporter-trace-otlp-http
```

### 8. Environment Variables

Add to your `.env` file:

```env
# OpenTelemetry Configuration
OTEL_SERVICE_NAME=trademachine-server
OTEL_SERVICE_VERSION=2.0.1
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_RESOURCE_ATTRIBUTES="service.name=trademachine-server,service.version=2.0.1"

# Optional: Control trace sampling
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1  # Sample 10% of traces
```

## Integration with Existing Infrastructure

### Rollbar Integration
You can correlate Rollbar errors with traces by adding trace context:

```typescript
import { trace } from '@opentelemetry/api';
import { rollbar } from './bootstrap/rollbar';

// In error handling
const span = trace.getActiveSpan();
const traceId = span?.spanContext().traceId;

rollbar.error(error, {
  custom: {
    traceId,
    spanId: span?.spanContext().spanId,
  }
});
```

### Existing Prometheus Metrics
The OpenTelemetry auto-instrumentation will work alongside your existing `express-prom-bundle` metrics.

## Testing the Integration

### 1. Start Both Applications
```bash
# Terminal 1: Backend
cd TradeMachineServer && npm run dev-server

# Terminal 2: Frontend
cd TradeMachineClientV3 && npm run dev
```

### 2. Verify Trace Headers
Check that requests include trace headers:
- `traceparent`: W3C trace context header
- `tracestate`: Additional vendor-specific trace state

### 3. Confirm Span Creation
Look for trace logs in your backend console or trace export destination.

## Expected Result

Once implemented, you'll have:
- ✅ End-to-end tracing from frontend user actions to backend API responses
- ✅ Automatic instrumentation of HTTP requests, database queries, and external calls
- ✅ Correlated traces between frontend (Faro) and backend (OpenTelemetry)
- ✅ Rich context including user info, HTTP details, and performance metrics

## Troubleshooting

### Common Issues:
1. **No trace context**: Ensure telemetry is initialized before other imports
2. **Missing spans**: Check that TracingInstrumentation is enabled on frontend
3. **Broken traces**: Verify both systems send to same trace backend
4. **Performance impact**: Adjust sampling rates in production

### Debug Mode:
```typescript
// Add to telemetry.ts for debugging
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
```