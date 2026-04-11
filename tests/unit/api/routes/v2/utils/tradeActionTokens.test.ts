import { mockClear, mockDeep } from "jest-mock-extended";
import type { RedisClientType } from "redis";

const mockRedisV4 = mockDeep<RedisClientType>();
jest.mock("../../../../../../src/bootstrap/express", () => ({
    redisClient: {
        v4: mockRedisV4,
    },
}));

import {
    consumeTradeActionToken,
    createTradeActionToken,
    TRADE_ACTION_TOKEN_CONFIG,
} from "../../../../../../src/api/routes/v2/utils/tradeActionTokens";

describe("tradeActionTokens utils", () => {
    const mockRedis = mockRedisV4 as jest.Mocked<RedisClientType>;

    beforeEach(() => {
        mockClear(mockRedis);
    });

    describe("createTradeActionToken", () => {
        it("stores accept payload in Redis and returns 64-char hex", async () => {
            mockRedis.setNX.mockResolvedValue(true);
            mockRedis.expire.mockResolvedValue(true);

            const token = await createTradeActionToken({
                userId: "u1",
                tradeId: "t1-action",
                action: "accept",
            });

            expect(token).toMatch(/^[0-9a-f]{64}$/);
            expect(mockRedis.setNX).toHaveBeenCalledWith(
                `trade-action:${token}`,
                JSON.stringify({ userId: "u1", tradeId: "t1-action", action: "accept" })
            );
            expect(mockRedis.expire).toHaveBeenCalledWith(
                `trade-action:${token}`,
                TRADE_ACTION_TOKEN_CONFIG.TTL_SECONDS
            );
        });

        it("supports view action (session-only, no auto-action)", async () => {
            mockRedis.setNX.mockResolvedValue(true);
            mockRedis.expire.mockResolvedValue(true);

            const token = await createTradeActionToken({
                userId: "u-view",
                tradeId: "trade-view",
                action: "view",
            });

            expect(token).toHaveLength(64);
            const stored = (mockRedis.setNX.mock.calls[0]?.[1] as string) ?? "";
            expect(JSON.parse(stored)).toMatchObject({
                userId: "u-view",
                tradeId: "trade-view",
                action: "view",
            });
        });

        it("does not call expire when setNX loses (collision)", async () => {
            mockRedis.setNX.mockResolvedValue(false);

            const token = await createTradeActionToken({
                userId: "u1",
                tradeId: "t1",
                action: "submit",
            });

            expect(token).toHaveLength(64);
            expect(mockRedis.expire).not.toHaveBeenCalled();
        });
    });

    describe("consumeTradeActionToken", () => {
        it("returns parsed payload and deletes key", async () => {
            const payload = { userId: "u1", tradeId: "t1", action: "decline" as const };
            mockRedis.get.mockResolvedValue(JSON.stringify(payload));
            mockRedis.del.mockResolvedValue(1);

            const hex = "a".repeat(64);
            const result = await consumeTradeActionToken(hex);

            expect(result).toEqual(payload);
            expect(mockRedis.get).toHaveBeenCalledWith(`trade-action:${hex}`);
            expect(mockRedis.del).toHaveBeenCalledWith(`trade-action:${hex}`);
        });

        it("returns null when key missing", async () => {
            mockRedis.get.mockResolvedValue(null);

            const result = await consumeTradeActionToken("b".repeat(64));

            expect(result).toBeNull();
            expect(mockRedis.del).not.toHaveBeenCalled();
        });
    });
});
