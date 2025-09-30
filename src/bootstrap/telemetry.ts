import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { RedisInstrumentation } from "@opentelemetry/instrumentation-redis";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env file before initializing telemetry
dotenvConfig({ path: resolve(__dirname, "../../.env") });

// Enable OpenTelemetry logging based on environment variable
const logLevel = process.env.OTEL_LOG_LEVEL?.toUpperCase() === "DEBUG" ? DiagLogLevel.DEBUG : DiagLogLevel.INFO;
diag.setLogger(new DiagConsoleLogger(), logLevel);

const serviceName = process.env.OTEL_SERVICE_NAME || "trademachine-server";
const serviceVersion = process.env.OTEL_SERVICE_VERSION || process.env.npm_package_version || "2.0.1";
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

// Create SDK configuration - only include OTLP exporters if endpoint is configured
const baseConfig = {
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    instrumentations: [
        getNodeAutoInstrumentations({
            "@opentelemetry/instrumentation-fs": {
                enabled: false, // Disable file system instrumentation (noisy)
            },
            "@opentelemetry/instrumentation-net": {
                enabled: false, // Disable network instrumentation (noisy)
            },
            "@opentelemetry/instrumentation-http": {
                enabled: true, // Enable HTTP instrumentation for request tracing
                ignoreIncomingRequestHook: req => {
                    // Ignore health checks and metrics endpoints
                    const url = req.url || "";
                    return url.includes("/health") || url.includes("/metrics");
                },
            },
            "@opentelemetry/instrumentation-express": {
                enabled: true, // Enable Express instrumentation
            },
        }),
        // Redis instrumentation for session storage and Bull queue operations
        new RedisInstrumentation(),
    ],
};

// Allow separate configuration for traces and metrics endpoints
const tracesEndpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || (otlpEndpoint ? `${otlpEndpoint}/v1/traces` : undefined);
const metricsEndpoint =
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || (otlpEndpoint ? `${otlpEndpoint}/v1/metrics` : undefined);

// Build SDK config with only configured exporters
const sdkConfig = {
    ...baseConfig,
    ...(tracesEndpoint && { traceExporter: new OTLPTraceExporter({ url: tracesEndpoint }) }),
    ...(metricsEndpoint && {
        metricReaders: [
            new PeriodicExportingMetricReader({
                exporter: new OTLPMetricExporter({ url: metricsEndpoint }),
            }),
        ],
    }),
};

export const sdk = new NodeSDK(sdkConfig);

// Initialize telemetry (should be called early in app startup)
export function initializeTelemetry(): void {
    try {
        sdk.start();
        // eslint-disable-next-line no-console
        console.log("OpenTelemetry started successfully", {
            serviceName,
            serviceVersion,
            tracesEndpoint: tracesEndpoint || "Not configured",
            metricsEndpoint: metricsEndpoint || "Not configured",
            generalEndpoint: otlpEndpoint || "Not configured",
            sampler: process.env.OTEL_TRACES_SAMPLER || "parentbased_always_on",
            samplerArg: process.env.OTEL_TRACES_SAMPLER_ARG || "1.0",
        });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error initializing OpenTelemetry:", error);
    }
}

// Graceful shutdown
export function shutdownTelemetry(): void {
    sdk.shutdown()
        // eslint-disable-next-line no-console
        .then(() => console.log("OpenTelemetry terminated"))
        // eslint-disable-next-line no-console
        .catch(error => console.error("Error terminating OpenTelemetry", error));
}
