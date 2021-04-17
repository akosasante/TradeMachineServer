import { Job, JobOptions } from "bull";

export function cleanJobForLogging(job: Job, cleanReturnValue: (arg0: any) => any, cleanData: (arg0: any) => any): { returnValue: any; opts: JobOptions; processedOn: number | undefined; data: any; attemptsMade: number; name: string; id: number | string; finishedOn: number | undefined } {
    return {
        opts: job.opts,
        name: job.name,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        id: job.id,
        finishedOn: job.finishedOn,
        // failedReason: job.failedReason?,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: cleanData(job.data),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        returnValue: cleanReturnValue(job.returnvalue),
    };
}
