import { mockDeep, mockClear } from "jest-mock-extended";
import SyncJobExecutionDAO from "../../../../src/DAO/v2/SyncJobExecutionDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import { daoTestLifecycle, expectDaoRequiresPrismaClient } from "./daoTestHelpers";
import { SyncJobType } from "@prisma/client";

const makeSyncExecution = (overrides: Record<string, unknown> = {}) => ({
    id: "sync-exec-1",
    obanJobId: BigInt(42),
    jobType: SyncJobType.espn_team_sync,
    startedAt: new Date(),
    completedAt: null,
    status: "running",
    error: null,
    ...overrides,
});

describe("[PRISMA] SyncJobExecutionDAO", () => {
    const prisma = mockDeep<ExtendedPrismaClient["syncJobExecution"]>();
    const dao = new SyncJobExecutionDAO(prisma as unknown as ExtendedPrismaClient["syncJobExecution"]);

    daoTestLifecycle("SYNC JOB EXECUTION");
    afterEach(() => {
        mockClear(prisma);
    });

    expectDaoRequiresPrismaClient(SyncJobExecutionDAO, "SyncJobExecutionDAO");

    describe("getByObanJobId", () => {
        it("should find the most recent execution for a given oban job id", async () => {
            const exec = makeSyncExecution();
            prisma.findFirst.mockResolvedValueOnce(exec as any);

            const result = await dao.getByObanJobId(BigInt(42));

            expect(prisma.findFirst).toHaveBeenCalledWith({
                where: { obanJobId: BigInt(42) },
                orderBy: { startedAt: "desc" },
            });
            expect(result).toEqual(exec);
        });

        it("should return null when no execution matches", async () => {
            prisma.findFirst.mockResolvedValueOnce(null);

            const result = await dao.getByObanJobId(BigInt(999));

            expect(result).toBeNull();
        });
    });

    describe("getLatestByJobType", () => {
        it("should find the most recent execution for a given job type", async () => {
            const exec = makeSyncExecution({ jobType: SyncJobType.mlb_players_sync });
            prisma.findFirst.mockResolvedValueOnce(exec as any);

            const result = await dao.getLatestByJobType(SyncJobType.mlb_players_sync);

            expect(prisma.findFirst).toHaveBeenCalledWith({
                where: { jobType: SyncJobType.mlb_players_sync },
                orderBy: { startedAt: "desc" },
            });
            expect(result).toEqual(exec);
        });

        it("should return null when no execution exists for the job type", async () => {
            prisma.findFirst.mockResolvedValueOnce(null);

            const result = await dao.getLatestByJobType(SyncJobType.minors_sync);

            expect(result).toBeNull();
        });
    });
});
