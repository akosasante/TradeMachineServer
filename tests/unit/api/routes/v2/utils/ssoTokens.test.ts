import { mockClear, mockDeep } from "jest-mock-extended";
import type { RedisClientType } from "redis";
import * as ssoTokens from "../../../../../../src/api/routes/v2/utils/ssoTokens";

// Mock the redis client
jest.mock("../../../../../../src/bootstrap/express", () => ({
    redisClient: {
        v4: mockDeep<RedisClientType>(),
    },
}));

import { redisClient } from "../../../../../../src/bootstrap/express";
const mockRedisClientV4 = redisClient.v4 as jest.Mocked<RedisClientType>;

describe("ssoTokens utils", () => {
    beforeEach(() => {
        mockClear(mockRedisClientV4);
    });

    describe("createTransferToken", () => {
        it("should generate a token and store it in redis", async () => {
            mockRedisClientV4.setNX.mockResolvedValue(true);
            mockRedisClientV4.expire.mockResolvedValue(true);

            const payload = { sessionId: "sessid", userId: "userid" };
            const token = await ssoTokens.createTransferToken(payload);

            expect(token).toHaveLength(64);
            expect(token).toMatch(/^[0-9a-f]{64}$/); // Hex string
            expect(mockRedisClientV4.setNX).toHaveBeenCalledWith(`sso:transfer:${token}`, JSON.stringify(payload));
            expect(mockRedisClientV4.expire).toHaveBeenCalledWith(
                `sso:transfer:${token}`,
                ssoTokens.SSO_CONFIG.TRANSFER_TOKEN_TTL_SECONDS
            );
        });

        it("should handle redis set collision (NX returns false)", async () => {
            mockRedisClientV4.setNX.mockResolvedValue(false); // Key already exists

            const payload = { sessionId: "sessid", userId: "userid" };
            const token = await ssoTokens.createTransferToken(payload);

            expect(token).toHaveLength(64);
            expect(mockRedisClientV4.setNX).toHaveBeenCalled();
            expect(mockRedisClientV4.expire).not.toHaveBeenCalled(); // Should not set expiration if key already exists
        });

        it("should generate unique tokens on subsequent calls", async () => {
            mockRedisClientV4.setNX.mockResolvedValue(true);
            mockRedisClientV4.expire.mockResolvedValue(true);

            const payload = { sessionId: "sessid", userId: "userid" };
            const token1 = await ssoTokens.createTransferToken(payload);
            const token2 = await ssoTokens.createTransferToken(payload);

            expect(token1).not.toBe(token2);
            expect(mockRedisClientV4.setNX).toHaveBeenCalledTimes(2);
        });
    });

    describe("consumeTransferToken", () => {
        it("should return payload and delete token if found", async () => {
            const payload = { sessionId: "sessid", userId: "userid" };
            mockRedisClientV4.get.mockResolvedValue(JSON.stringify(payload));
            mockRedisClientV4.del.mockResolvedValue(1);

            const result = await ssoTokens.consumeTransferToken("sometoken");

            expect(result).toEqual(payload);
            expect(mockRedisClientV4.get).toHaveBeenCalledWith("sso:transfer:sometoken");
            expect(mockRedisClientV4.del).toHaveBeenCalledWith("sso:transfer:sometoken");
        });

        it("should return null if token not found", async () => {
            mockRedisClientV4.get.mockResolvedValue(null);

            const result = await ssoTokens.consumeTransferToken("notfoundtoken");

            expect(result).toBeNull();
            expect(mockRedisClientV4.get).toHaveBeenCalledWith("sso:transfer:notfoundtoken");
            expect(mockRedisClientV4.del).not.toHaveBeenCalled();
        });

        it("should handle invalid JSON gracefully", async () => {
            mockRedisClientV4.get.mockResolvedValue("not-json");
            mockRedisClientV4.del.mockResolvedValue(1);

            const result = await ssoTokens.consumeTransferToken("badtoken");

            expect(result).toBeNull();
            expect(mockRedisClientV4.get).toHaveBeenCalledWith("sso:transfer:badtoken");
            expect(mockRedisClientV4.del).toHaveBeenCalledWith("sso:transfer:badtoken");
        });

        it("should still delete token even if JSON parsing fails", async () => {
            mockRedisClientV4.get.mockResolvedValue("invalid-json");
            mockRedisClientV4.del.mockResolvedValue(1);

            await ssoTokens.consumeTransferToken("badtoken");

            expect(mockRedisClientV4.del).toHaveBeenCalledWith("sso:transfer:badtoken");
        });
    });

    describe("loadOriginalSession", () => {
        const originalEnv = process.env.APP_ENV;

        afterEach(() => {
            process.env.APP_ENV = originalEnv;
        });

        it("should return parsed session data if found in production", async () => {
            const sessionData = {
                cookie: { expires: "2025-10-07T00:00:00Z" },
                user: "userid",
            };
            mockRedisClientV4.get.mockResolvedValue(JSON.stringify(sessionData));
            process.env.APP_ENV = "production";

            const result = await ssoTokens.loadOriginalSession("sessid");

            expect(mockRedisClientV4.get).toHaveBeenCalledWith("sess:sessid");
            expect(result).toEqual(sessionData);
        });

        it("should use staging prefix if APP_ENV is staging", async () => {
            const sessionData = {
                cookie: { expires: "2025-10-07T00:00:00Z" },
                user: "userid",
            };
            mockRedisClientV4.get.mockResolvedValue(JSON.stringify(sessionData));
            process.env.APP_ENV = "staging";

            const result = await ssoTokens.loadOriginalSession("sessid");

            expect(mockRedisClientV4.get).toHaveBeenCalledWith("stg_sess:sessid");
            expect(result).toEqual(sessionData);
        });

        it("should return null if session not found", async () => {
            mockRedisClientV4.get.mockResolvedValue(null);
            process.env.APP_ENV = "production";

            const result = await ssoTokens.loadOriginalSession("sessid");

            expect(result).toBeNull();
            expect(mockRedisClientV4.get).toHaveBeenCalledWith("sess:sessid");
        });

        it("should handle invalid JSON gracefully", async () => {
            mockRedisClientV4.get.mockResolvedValue("not-json");
            process.env.APP_ENV = "production";

            const result = await ssoTokens.loadOriginalSession("sessid");

            expect(result).toBeNull();
            expect(mockRedisClientV4.get).toHaveBeenCalledWith("sess:sessid");
        });

        it("should default to production prefix when APP_ENV is undefined", async () => {
            const sessionData = { cookie: { expires: "2025-10-07T00:00:00Z" } };
            mockRedisClientV4.get.mockResolvedValue(JSON.stringify(sessionData));
            delete process.env.APP_ENV;

            const result = await ssoTokens.loadOriginalSession("sessid");

            expect(mockRedisClientV4.get).toHaveBeenCalledWith("sess:sessid");
            expect(result).toEqual(sessionData);
        });
    });

    describe("SSO_CONFIG", () => {
        it("should export expected configuration", () => {
            expect(ssoTokens.SSO_CONFIG.TRANSFER_TOKEN_TTL_SECONDS).toBe(60);
            expect(ssoTokens.SSO_CONFIG.TOKEN_LENGTH).toBe(64);
            expect(ssoTokens.SSO_CONFIG.ALLOWED_REDIRECT_HOSTS).toBeInstanceOf(Set);
            expect(ssoTokens.SSO_CONFIG.ALLOWED_REDIRECT_HOSTS.has("https://trades.flexfoxfantasy.com")).toBe(true);
            expect(ssoTokens.SSO_CONFIG.ALLOWED_REDIRECT_HOSTS.has("https://ffftemp.akosua.xyz")).toBe(true);
        });
    });
});
