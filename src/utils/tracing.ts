import { Request, Response } from "express";
import { trace, context, propagation, SpanStatusCode } from "@opentelemetry/api";
import type { Context } from "@opentelemetry/api";

const tracer = trace.getTracer("trademachine-server");

interface SessionData {
    userId?: string;
    user?: string;
}

/**
 * Extract trace context from incoming request headers and create a new span
 */
export function createSpanFromRequest(
    operationName: string,
    req: Request
): { span: ReturnType<typeof tracer.startSpan>; context: Context } {
    // Extract trace context from incoming headers (W3C Trace Context)
    const activeContext = propagation.extract(context.active(), req.headers);

    // Safely access session data
    const sessionData = req.session as SessionData | undefined;
    const userId = sessionData?.userId || sessionData?.user || "anonymous";
    const isAuthenticated = !!(sessionData?.userId || sessionData?.user);

    // Create span with extracted context

    const span = tracer.startSpan(
        operationName,
        {
            attributes: {
                "http.method": req.method,
                "http.url": req.url,
                "http.route": (req.route as { path?: string } | undefined)?.path || "unknown",
                "http.user_agent": req.get("User-Agent") || "unknown",
                "user.id": userId,
                "user.authenticated": isAuthenticated,
            },
        },
        activeContext
    );

    return { span, context: activeContext };
}

/**
 * Finish span with appropriate status based on response
 */
export function finishSpanWithResponse(span: ReturnType<typeof tracer.startSpan>, res: Response, error?: Error): void {
    const contentLength = typeof res.get === "function" ? res.get("content-length") : undefined;

    span.setAttributes({
        "http.status_code": res.statusCode,
        "http.response.size": parseInt(contentLength || "0", 10),
    });

    if (error) {
        span.recordException(error);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
        });
    } else if (res.statusCode >= 400) {
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`,
        });
    } else {
        span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
}

/**
 * Add custom attributes to the active span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
        span.setAttributes(attributes);
    }
}

/**
 * Record an event on the active span
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
        span.addEvent(name, attributes);
    }
}

/**
 * Finish span with status code only (for cases without Response object)
 */
export function finishSpanWithStatusCode(span: ReturnType<typeof tracer.startSpan>, statusCode: number, error?: Error): void {
    span.setAttributes({
        "http.status_code": statusCode,
    });

    if (error) {
        span.recordException(error);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
        });
    } else if (statusCode >= 400) {
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${statusCode}`,
        });
    } else {
        span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
}

/**
 * Extract W3C trace context for passing to external services (like Oban jobs)
 */
export function extractTraceContext(): { traceparent: string; tracestate?: string } | null {
    const activeContext = context.active();
    if (!activeContext) {
        return null;
    }

    const carrier: Record<string, string> = {};

    // Inject current trace context into carrier using W3C format
    propagation.inject(activeContext, carrier);

    return {
        traceparent: carrier.traceparent || "",
        tracestate: carrier.tracestate,
    };
}
