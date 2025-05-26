import * as promClient from "prom-client";
import promBundle from "express-prom-bundle";

export const metricsRegistry = new promClient.Registry();

promClient.collectDefaultMetrics({
    register: metricsRegistry,
    labels: { app: "trade_machine", environment: process.env.APP_ENV },
});

export const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    promRegistry: metricsRegistry,
    customLabels: { app: "trade_machine", environment: process.env.APP_ENV },
});
