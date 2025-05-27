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
    autoregister: false,
});

/* eslint-disable @typescript-eslint/naming-convention */
const initializeJobMetrics = (registry: promClient.Registry) => {
    const TotalActiveJobs = new promClient.Gauge({
        name: "jobs_active_total",
        help: "Total number of active jobs in the queue",
        labelNames: ["queue_name"],
        registers: [registry],
    });
    const TotalCompletedJobs = new promClient.Gauge({
        name: "jobs_completed_total",
        help: "Total number of completed jobs in the queue",
        labelNames: ["queue_name"],
        registers: [registry],
    });
    const TotalFailedJobs = new promClient.Gauge({
        name: "jobs_failed_total",
        help: "Total number of failed jobs in the queue",
        labelNames: ["queue_name"],
        registers: [registry],
    });
    const TotalWaitingJobs = new promClient.Gauge({
        name: "jobs_waiting_total",
        help: "Total number of waiting jobs in the queue",
        labelNames: ["queue_name"],
        registers: [registry],
    });
    const TotalDelayedJobs = new promClient.Gauge({
        name: "jobs_delayed_total",
        help: "Total number of delayed jobs in the queue",
        labelNames: ["queue_name"],
        registers: [registry],
    });
    const NumberActiveJobs = new promClient.Counter({
        name: "jobs_active",
        help: "Number of active jobs in the timeframe",
        labelNames: ["queue_name", "job_name"],
        registers: [registry],
    });
    const NumberCompletedJobs = new promClient.Counter({
        name: "jobs_completed",
        help: "Number of completed jobs in the timeframe",
        labelNames: ["queue_name", "job_name"],
        registers: [registry],
    });
    const NumberFailedJobs = new promClient.Counter({
        name: "jobs_failed",
        help: "Number of failed jobs in the timeframe",
        labelNames: ["queue_name", "job_name"],
        registers: [registry],
    });
    const NumberWaitingJobs = new promClient.Counter({
        name: "jobs_waiting",
        help: "Number of waiting for an idle queue in the timeframe",
        labelNames: ["queue_name", "job_name"],
        registers: [registry],
    });
    const NumberStalledJobs = new promClient.Counter({
        name: "jobs_stalled",
        help: "Number of stalled jobs in the timeframe",
        labelNames: ["queue_name", "job_name"],
        registers: [registry],
    });
    const NumberQueueErrors = new promClient.Counter({
        name: "job_queue_errors",
        help: "Number of job errors in the timeframe",
        labelNames: ["queue_name"],
        registers: [registry],
    });
    const JobProcessingTime = new promClient.Histogram({
        name: "job_duration",
        help: "Duration of job processing in milliseconds",
        labelNames: ["queue_name", "job_name", "status"],
        registers: [registry],
    });
    const JobWaitingTime = new promClient.Histogram({
        name: "job_waiting_time",
        help: "Waiting time of jobs in milliseconds ",
        labelNames: ["queue_name", "job_name", "status"],
        registers: [registry],
    });
    const JobAttempts = new promClient.Summary({
        name: "job_attempts",
        help: "Number of attempts for jobs",
        labelNames: ["queue_name", "job_name", "status"],
        registers: [registry],
    });

    return {
        TotalActiveJobs,
        TotalCompletedJobs,
        TotalFailedJobs,
        TotalWaitingJobs,
        TotalDelayedJobs,
        NumberActiveJobs,
        NumberCompletedJobs,
        NumberFailedJobs,
        NumberWaitingJobs,
        NumberStalledJobs,
        NumberQueueErrors,
        JobProcessingTime,
        JobWaitingTime,
        JobAttempts,
    };
};
/* eslint-enable @typescript-eslint/naming-convention */

export const availableJobMetrics = (() => {
    return initializeJobMetrics(metricsRegistry);
})();

export const activeUserMetric = (() => {
    return new promClient.Gauge({
        name: "trade_machine_active_sessions",
        help: "Number of active user sessions",
        registers: [metricsRegistry],
    });
})();
