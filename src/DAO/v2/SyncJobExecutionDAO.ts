import { SyncJobType } from "@prisma/client";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

export default class SyncJobExecutionDAO {
    private readonly syncDb: ExtendedPrismaClient["syncJobExecution"];

    constructor(syncDb: ExtendedPrismaClient["syncJobExecution"] | undefined) {
        if (!syncDb) {
            throw new Error("SyncJobExecutionDAO must be initialized with a PrismaClient model instance!");
        }
        this.syncDb = syncDb;
    }

    public async getByObanJobId(obanJobId: bigint) {
        return this.syncDb.findFirst({
            where: { obanJobId },
            orderBy: { startedAt: "desc" },
        });
    }

    public async getLatestByJobType(jobType: SyncJobType) {
        return this.syncDb.findFirst({
            where: { jobType },
            orderBy: { startedAt: "desc" },
        });
    }
}
