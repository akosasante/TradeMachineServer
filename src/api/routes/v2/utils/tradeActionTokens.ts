import crypto from "crypto";
import { redisClient } from "../../../../bootstrap/express";
import logger from "../../../../bootstrap/logger";

export type TradeAction = "accept" | "decline" | "submit";

export interface TradeActionTokenPayload {
    userId: string;
    tradeId: string;
    action: TradeAction;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const redisClientV4: {
    setNX: (key: string, value: string) => Promise<boolean>;
    expire: (key: string, seconds: number) => Promise<boolean>;
    get: (key: string) => Promise<string | null>;
    del: (key: string) => Promise<number>;
} = redisClient.v4 as any;

const TRADE_ACTION_TOKEN_PREFIX = "trade-action:";

export const TRADE_ACTION_TOKEN_CONFIG = {
    TTL_SECONDS: 48 * 60 * 60, // 48 hours
} as const;

/**
 * Creates a short-lived, single-use token for a trade action (accept/decline/submit).
 * Used to generate magic link URLs embedded in trade notification emails.
 * The token is stored in Redis and associates a user+trade+action with a 48h TTL.
 */
export async function createTradeActionToken(payload: TradeActionTokenPayload): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const key = `${TRADE_ACTION_TOKEN_PREFIX}${token}`;

    const redisPayload: TradeActionTokenPayload = {
        userId: String(payload.userId),
        tradeId: String(payload.tradeId),
        action: payload.action,
    };

    // NX = Only set if Not eXists — prevents overwriting on (astronomically unlikely) collision
    const setResult = await redisClientV4.setNX(key, JSON.stringify(redisPayload));
    if (setResult) {
        await redisClientV4.expire(key, TRADE_ACTION_TOKEN_CONFIG.TTL_SECONDS);
        logger.debug(`[createTradeActionToken] Created token for userId=${payload.userId} tradeId=${payload.tradeId} action=${payload.action}`);
    } else {
        logger.warn(`[createTradeActionToken] Token collision or duplicate — key already existed: ${key}`);
    }

    return token;
}

/**
 * Consumes (validates and deletes) a trade action token from Redis.
 * Returns the token payload if valid, or null if expired/invalid.
 * Tokens are single-use — the Redis key is deleted immediately upon consumption.
 */
export async function consumeTradeActionToken(token: string): Promise<TradeActionTokenPayload | null> {
    const key = `${TRADE_ACTION_TOKEN_PREFIX}${token}`;
    const val = await redisClientV4.get(key);

    if (!val) {
        logger.debug(`[consumeTradeActionToken] Token not found or expired: ${token.slice(0, 8)}...`);
        return null;
    }

    await redisClientV4.del(key);

    try {
        const payload = JSON.parse(val) as TradeActionTokenPayload;
        logger.debug(`[consumeTradeActionToken] Token consumed for userId=${payload.userId} tradeId=${payload.tradeId} action=${payload.action}`);
        return payload;
    } catch {
        logger.warn(`[consumeTradeActionToken] Failed to parse token payload for key=${key}`);
        return null;
    }
}
