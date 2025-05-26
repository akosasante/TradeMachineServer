/* eslint-disable @typescript-eslint/naming-convention */

import Bull from "bull";
import { availableJobMetrics } from "../bootstrap/metrics";
import { registerCleanupCallback } from "../bootstrap/shutdownHandler";
import logger from "../bootstrap/logger";

export function recordJobMetrics(queue: Bull.Queue): void {
    const recordDurationMetrics = (job: Bull.Job, status: string) => {
        if (job.finishedOn && job.processedOn) {
            const jobDuration = job.finishedOn - job.processedOn;
            availableJobMetrics.JobProcessingTime.observe(
                { queue_name: queue.name, job_name: job.name, status },
                jobDuration
            );
            availableJobMetrics.JobWaitingTime.observe(
                { queue_name: queue.name, job_name: job.name, status },
                job.processedOn - job.timestamp
            );
            availableJobMetrics.JobAttempts.observe(
                { queue_name: queue.name, job_name: job.name, status },
                job.attemptsMade
            );
        }
    };

    queue.on("error", () => {
        availableJobMetrics.NumberQueueErrors.inc({ queue_name: queue.name });
    });
    queue.on("stalled", (job: Bull.Job) => {
        availableJobMetrics.NumberStalledJobs.inc({ queue_name: queue.name, job_name: job.name });
    });
    queue.on("active", job => {
        availableJobMetrics.NumberActiveJobs.inc({ queue_name: queue.name, job_name: job.name });
    });
    queue.on("waiting", (jobId: Bull.JobId) => {
        void (async () => {
            const job = await queue.getJob(jobId);
            availableJobMetrics.NumberWaitingJobs.inc({ queue_name: queue.name, job_name: job?.name || "unknown" });
        })();
    });
    queue.on("completed", (job: Bull.Job) => {
        availableJobMetrics.NumberCompletedJobs.inc({ queue_name: queue.name, job_name: job.name });
        recordDurationMetrics(job, "completed");
    });
    queue.on("failed", (job, _err) => {
        availableJobMetrics.NumberFailedJobs.inc({ queue_name: queue.name, job_name: job.name });
        recordDurationMetrics(job, "failed");
    });

    const gaugeInterval = setInterval(() => {
        void (async () => {
            try {
                const jobCounts = await queue.getJobCounts();
                availableJobMetrics.TotalActiveJobs.set({ queue_name: queue.name }, jobCounts.active);
                availableJobMetrics.TotalWaitingJobs.set({ queue_name: queue.name }, jobCounts.waiting);
                availableJobMetrics.TotalDelayedJobs.set({ queue_name: queue.name }, jobCounts.delayed);
                availableJobMetrics.TotalCompletedJobs.inc({ queue_name: queue.name }, jobCounts.completed);
                availableJobMetrics.TotalFailedJobs.inc({ queue_name: queue.name }, jobCounts.failed);
            } catch (error) {
                logger.error(`Error updating job metrics for queue ${queue.name}: ${error}`);
            }
        })();
    }, 60000);

    registerCleanupCallback(async () => {
        clearInterval(gaugeInterval);
        logger.info(`Cleared job metrics interval for queue ${queue.name}`);
        await queue.close();
    });
}

/* eslint-enable @typescript-eslint/naming-convention */
