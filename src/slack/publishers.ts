import Bull, { JobOptions, Queue } from "bull";
import { Publisher } from "../scheduled_jobs/publisher";
import Trade from "../models/trade";
import logger from "../bootstrap/logger";
import { recordJobMetrics } from "../scheduled_jobs/metrics";

export class SlackPublisher extends Publisher {
    private static instance: SlackPublisher;

    private constructor(queue: Queue) {
        super();
        this.queue = queue;
    }

    public static getInstance(queue?: Queue): SlackPublisher {
        if (!SlackPublisher.instance) {
            let queueName;
            if (process.env.NODE_ENV === "test") {
                queueName = "test_slack_queue";
            } else if (process.env.ORM_CONFIG === "staging") {
                queueName = "stg_slack_queue";
            } else {
                queueName = "slack_queue";
            }
            SlackPublisher.instance = new SlackPublisher(
                queue ||
                    new Bull(queueName, {
                        redis: {
                            host: process.env.REDIS_IP || "localhost",
                            port: Number(process.env.REDIS_PORT || 6379),
                            password: process.env.REDISPASS,
                            family: 4, // Force IPv4 to avoid Node 20's IPv6 preference
                        },
                    })
            );
            recordJobMetrics(SlackPublisher.instance.queue!);
            logger.info(`SlackPublisher initialized with queue: ${queueName}`);
        }

        return SlackPublisher.instance;
    }

    public async queueTradeAnnouncement(trade: Trade): Promise<Bull.Job> {
        const jobName = "trade_announce";
        const opts: JobOptions = { attempts: 3, backoff: { type: "exponential", delay: 30000 } };
        logger.debug("queuing trade announcement response");

        return await this.queue!.add(jobName, { trade: JSON.stringify(trade) }, opts);
    }
}
