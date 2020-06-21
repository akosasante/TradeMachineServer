import { Queue } from "bull";

export class Publisher {
    protected queue?: Queue;

    // tslint:disable-next-line:no-empty
    protected constructor() { }

    public async getJobTotal(): Promise<number> {
        return Object.values(await this.queue!.getJobCounts())
            .reduce((val1: number, val2: number) => val1 + val2);
    }

    public async cleanWaitQueue() {
        return this.queue?.clean(100, "wait");
    }
}
