import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import logger from "./logger";

const serviceName = "trademachine-server";
const serviceVersion = process.env.npm_package_version || "2.0.1";

export const sdk = new NodeSDK({
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
    ],
});

// Initialize telemetry (should be called early in app startup)
export function initializeTelemetry(): void {
    try {
        sdk.start();
        logger.info("OpenTelemetry started successfully");
    } catch (error) {
        logger.error("Error initializing OpenTelemetry:", error);
    }
}

// Graceful shutdown
export function shutdownTelemetry(): void {
    sdk
        .shutdown()
        .then(() => logger.info("OpenTelemetry terminated"))
        .catch(error => logger.error("Error terminating OpenTelemetry", error));
}