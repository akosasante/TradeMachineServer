import { oban_job_state } from "@prisma/client";

/**
 * Minimal mock Oban job rows for unit tests that assert on `obanJob.create(...)`
 * calls. The DAO only ever reads `id`/`state` off the returned row, so this stub
 * intentionally stays small. Replaces the inline `{ id: BigInt(n), state: ... }`
 * literals scattered across the ObanDAO unit tests.
 */
export class ObanJobFactory {
    public static getMockJob(
        id = 1,
        state: oban_job_state = oban_job_state.available
    ): { id: bigint; state: oban_job_state } {
        return { id: BigInt(id), state };
    }
}
