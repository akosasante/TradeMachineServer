import Bull, { JobCounts, Queue } from "bull";
import logger from "../bootstrap/logger";
import { registerCleanupCallback } from "../bootstrap/shutdownHandler";

interface TypedJobCounts extends JobCounts {
    [key: string]: number;
}

export class Publisher {
    protected queue?: Queue;

    protected constructor() {
        registerCleanupCallback(async () => {
            await this.closeQueue();
        });
    }

    public async getJobTotal(): Promise<number> {
        return Object.values<number>((await this.queue!.getJobCounts()) as TypedJobCounts).reduce(
            (val1: number, val2: number) => val1 + val2
        );
    }

    public async cleanWaitQueue(): Promise<Bull.Job[]> {
        return this.queue!.clean(100, "wait");
    }

    public async closeQueue(wait = false): Promise<void> {
        return this.queue!.close(wait)
            .then(() => {
                logger.info(`Closing the queue. ${this.queue!.name}`);
            })
            .catch(() => {
                logger.error(`Error closing queue. ${this.queue!.name}`);
            });
    }
}
