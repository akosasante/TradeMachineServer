import { mockDeep, mockClear } from "jest-mock-extended";
import ObanDAO from "../../../../src/DAO/v2/ObanDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import { oban_job_state } from "@prisma/client";

describe("ObanDAO Sync Enqueue Helpers", () => {
    const mockPrismaObanJob = mockDeep<ExtendedPrismaClient["obanJob"]>();
    let obanDao: ObanDAO;

    beforeEach(() => {
        mockClear(mockPrismaObanJob);
        obanDao = new ObanDAO(mockPrismaObanJob as any);
    });

    const traceContext = { traceparent: "00-abc-def-01", tracestate: "test=1" };
    const mockJob = { id: BigInt(100), state: oban_job_state.available };

    describe("enqueueEspnTeamSync", () => {
        it("should enqueue with correct queue, worker, and max_attempts", async () => {
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);
            await obanDao.enqueueEspnTeamSync(traceContext);

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    queue: "espn_sync",
                    worker: "TradeMachine.Jobs.EspnTeamSync",
                    max_attempts: 3,
                    state: oban_job_state.available,
                    args: { trace_context: traceContext },
                }),
            });
        });
    });

    describe("enqueueEspnMlbPlayersSync", () => {
        it("should enqueue with correct queue and worker", async () => {
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);
            await obanDao.enqueueEspnMlbPlayersSync();

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    queue: "espn_sync",
                    worker: "TradeMachine.Jobs.EspnMlbPlayersSync",
                    max_attempts: 3,
                }),
            });
        });
    });

    describe("enqueueMinorsSync", () => {
        it("should enqueue with minors_sync queue", async () => {
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);
            await obanDao.enqueueMinorsSync(traceContext);

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    queue: "minors_sync",
                    worker: "TradeMachine.Jobs.MinorsSync",
                    max_attempts: 3,
                    args: { trace_context: traceContext },
                }),
            });
        });
    });

    describe("enqueueDraftPicksSync", () => {
        it("should enqueue with draft_sync queue", async () => {
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);
            await obanDao.enqueueDraftPicksSync();

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    queue: "draft_sync",
                    worker: "TradeMachine.Jobs.DraftPicksSync",
                    max_attempts: 3,
                }),
            });
        });
    });

    describe("trace_context propagation", () => {
        it("should pass undefined trace_context when not provided", async () => {
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);
            await obanDao.enqueueEspnTeamSync();

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    args: { trace_context: undefined },
                }),
            });
        });
    });
});
