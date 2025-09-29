import {NodeSDK} from "@opentelemetry/sdk-node";
import {getNodeAutoInstrumentations} from "@opentelemetry/auto-instrumentations-node";
import {OTLPTraceExporter} from "@opentelemetry/exporter-trace-otlp-proto";
import {OTLPMetricExporter} from "@opentelemetry/exporter-metrics-otlp-proto";
import {resourceFromAttributes} from "@opentelemetry/resources";
import {ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION} from "@opentelemetry/semantic-conventions";
import {PeriodicExportingMetricReader} from "@opentelemetry/sdk-metrics";
import {RedisInstrumentation} from "@opentelemetry/instrumentation-redis";
import {diag, DiagConsoleLogger, DiagLogLevel} from "@opentelemetry/api";

// Enable OpenTelemetry logging based on environment variable
const logLevel = process.env.OTEL_LOG_LEVEL?.toUpperCase() === "DEBUG" ? DiagLogLevel.DEBUG : DiagLogLevel.INFO;
diag.setLogger(new DiagConsoleLogger(), logLevel);

const serviceName = process.env.OTEL_SERVICE_NAME || "trademachine-server";
const serviceVersion = process.env.OTEL_SERVICE_VERSION || process.env.npm_package_version || "2.0.1";

// Use environment variables for OTLP configuration (NodeSDK auto-detection)
export const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    traceExporter: new OTLPTraceExporter({url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`}),
    metricReaders: [
        new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`}),
        })],
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
});

// Initialize telemetry (should be called early in app startup)
export function initializeTelemetry(): void {
    try {
        sdk.start();
        console.log("OpenTelemetry started successfully", {
            serviceName,
            serviceVersion,
            exporterType: "OTLP HTTP (explicit)",
            otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
            sampler: process.env.OTEL_TRACES_SAMPLER || "parentbased_always_on",
            samplerArg: process.env.OTEL_TRACES_SAMPLER_ARG || "1.0"
        });
    } catch (error) {
        console.error("Error initializing OpenTelemetry:", error);
    }
}

// Graceful shutdown
export function shutdownTelemetry(): void {
    sdk
        .shutdown()
        .then(() => console.log("OpenTelemetry terminated"))
        .catch(error => console.error("Error terminating OpenTelemetry", error));
}