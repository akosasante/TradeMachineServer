import { Job } from "bull";

export function cleanJobForLogging(job: Job, cleanReturnValue: (arg0: any) => any, cleanData: (arg0: any) => any) {
    return {
        opts: job.opts,
        name: job.name,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        id: job.id,
        finishedOn: job.finishedOn,
        // failedReason: job.failedReason?,
        data: cleanData(job.data),
        returnValue: cleanReturnValue(job.returnvalue),
    };
}
