import crypto from "crypto";
import { redisClient } from "../../../../bootstrap/express";
import { SessionData } from "express-session";

interface StoredSessionPayload {
    sessionId: string;
    userId: string;
}

type StoredSessionData = Partial<SessionData>;

// Allow only these redirect hosts
const ALLOWED_REDIRECT_HOSTS = new Set([
    "trades.flexfoxfantasy.com",
    "staging.trades.akosua.xyz",
    "ffftemp.akosua.xyz",
    "ffftemp.netlify.app",
]);

export const SSO_CONFIG = {
    TRANSFER_TOKEN_TTL_SECONDS: 60,
    TOKEN_LENGTH: 64,
    ALLOWED_REDIRECT_HOSTS,
} as const;

export async function createTransferToken(payload: StoredSessionPayload): Promise<string> {
    const token = crypto.randomBytes(32).toString("hex");
    const key = `sso:transfer:${token}`;

    // Ensure all values are strings for Redis
    const redisPayload = {
        sessionId: String(payload.sessionId),
        userId: String(payload.userId),
    };

    // EX = Expiration TTL in seconds, after which the key is deleted
    // NX = Only set if (N)ot e(X)ists, to avoid overwriting existing tokens. Will return null in that case.
    await redisClient.set(key, JSON.stringify(redisPayload), { EX: SSO_CONFIG.TRANSFER_TOKEN_TTL_SECONDS, NX: true });
    return token;
}

export async function consumeTransferToken(token: string): Promise<StoredSessionPayload | null> {
    const key = `sso:transfer:${token}`;
    const val = await redisClient.get(key);
    if (!val) return null;
    await redisClient.del(key); // single-use
    try {
        return JSON.parse(val) as StoredSessionPayload;
    } catch {
        return null;
    }
}

export async function loadOriginalSession(sessionId: string): Promise<StoredSessionData | null> {
    // Default connect-redis / express-session key pattern: sess:<sid> or stg_sess:<sid>
    const prefix = process.env.APP_ENV === "staging" ? "stg_sess" : "sess";
    const raw = await redisClient.get(`${prefix}:${sessionId}`);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as StoredSessionData;
    } catch {
        return null;
    }
}
