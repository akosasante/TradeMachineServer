import { mockDeep, mockClear } from "jest-mock-extended";
import ObanDAO from "../../../../src/DAO/v2/ObanDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import { oban_job_state } from "@prisma/client";

describe("ObanDAO Unit Tests", () => {
    const mockPrismaObanJob = mockDeep<ExtendedPrismaClient["obanJob"]>();
    let obanDao: ObanDAO;

    const originalEnv = process.env.APP_ENV;

    beforeEach(() => {
        mockClear(mockPrismaObanJob);
        obanDao = new ObanDAO(mockPrismaObanJob as any);
    });

    afterEach(() => {
        // Restore original APP_ENV
        if (originalEnv !== undefined) {
            process.env.APP_ENV = originalEnv;
        } else {
            delete process.env.APP_ENV;
        }
    });

    describe("enqueuePasswordResetEmail", () => {
        it("should set env to 'production' when APP_ENV is production", async () => {
            process.env.APP_ENV = "production";

            const userId = "user-123";
            const traceContext = { traceparent: "test-trace", tracestate: "test-state" };

            const mockJob = { id: BigInt(1), state: oban_job_state.available };
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);

            await obanDao.enqueuePasswordResetEmail(userId, traceContext);

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    args: expect.objectContaining({
                        env: "production",
                        email_type: "reset_password",
                        data: userId,
                        trace_context: traceContext,
                    }),
                }),
            });
        });

        it("should set env to 'staging' when APP_ENV is staging", async () => {
            process.env.APP_ENV = "staging";

            const userId = "user-456";

            const mockJob = { id: BigInt(2), state: oban_job_state.available };
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);

            await obanDao.enqueuePasswordResetEmail(userId);

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    args: expect.objectContaining({
                        env: "staging",
                        email_type: "reset_password",
                        data: userId,
                    }),
                }),
            });
        });

        it("should default to 'staging' when APP_ENV is not set", async () => {
            delete process.env.APP_ENV;

            const userId = "user-789";

            const mockJob = { id: BigInt(3), state: oban_job_state.available };
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);

            await obanDao.enqueuePasswordResetEmail(userId);

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    args: expect.objectContaining({
                        env: "staging",
                        email_type: "reset_password",
                        data: userId,
                    }),
                }),
            });
        });

        it("should set env to 'development' when APP_ENV is development", async () => {
            process.env.APP_ENV = "development";

            const userId = "user-dev";

            const mockJob = { id: BigInt(4), state: oban_job_state.available };
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);

            await obanDao.enqueuePasswordResetEmail(userId);

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    args: expect.objectContaining({
                        env: "development",
                        email_type: "reset_password",
                        data: userId,
                    }),
                }),
            });
        });
    });

    describe("enqueueRegistrationEmail", () => {
        it("should set env to 'production' when APP_ENV is production", async () => {
            process.env.APP_ENV = "production";

            const userId = "user-reg-123";
            const traceContext = { traceparent: "test-trace-reg" };

            const mockJob = { id: BigInt(5), state: oban_job_state.available };
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);

            await obanDao.enqueueRegistrationEmail(userId, traceContext);

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    args: expect.objectContaining({
                        env: "production",
                        email_type: "registration_email",
                        data: userId,
                        trace_context: traceContext,
                    }),
                }),
            });
        });

        it("should set env to 'staging' when APP_ENV is staging", async () => {
            process.env.APP_ENV = "staging";

            const userId = "user-reg-456";

            const mockJob = { id: BigInt(6), state: oban_job_state.available };
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);

            await obanDao.enqueueRegistrationEmail(userId);

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    args: expect.objectContaining({
                        env: "staging",
                        email_type: "registration_email",
                        data: userId,
                    }),
                }),
            });
        });

        it("should default to 'staging' when APP_ENV is not set", async () => {
            delete process.env.APP_ENV;

            const userId = "user-reg-789";

            const mockJob = { id: BigInt(7), state: oban_job_state.available };
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);

            await obanDao.enqueueRegistrationEmail(userId);

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    args: expect.objectContaining({
                        env: "staging",
                        email_type: "registration_email",
                        data: userId,
                    }),
                }),
            });
        });

        it("should set env to 'development' when APP_ENV is development", async () => {
            process.env.APP_ENV = "development";

            const userId = "user-reg-dev";

            const mockJob = { id: BigInt(8), state: oban_job_state.available };
            mockPrismaObanJob.create.mockResolvedValue(mockJob as any);

            await obanDao.enqueueRegistrationEmail(userId);

            expect(mockPrismaObanJob.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    args: expect.objectContaining({
                        env: "development",
                        email_type: "registration_email",
                        data: userId,
                    }),
                }),
            });
        });
    });
});
