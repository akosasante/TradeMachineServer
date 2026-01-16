import crypto from "crypto";
import { redisClient } from "../../../../bootstrap/express";
import { SessionData } from "express-session";

interface StoredSessionPayload {
    sessionId: string;
    userId: string;
}

type StoredSessionData = Partial<SessionData>;

const redisClientV4 = redisClient.v4 as unknown as typeof redisClient;

// Allow only these redirect hosts
const ALLOWED_REDIRECT_HOSTS = new Set([
    "https://trades.flexfoxfantasy.com",
    "https://staging.trades.akosua.xyz",
    "https://ffftemp.akosua.xyz",
    "https://ffftemp.netlify.app",
    "https://staging--ffftemp.netlify.app",
    "http://localhost:3030",
    "http://localhost:3031",
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

    // NX = Only set if (N)ot e(X)ists, to avoid overwriting existing tokens. Returns boolean true if set, false if not.
    const setResult = await redisClientV4.setNX(key, JSON.stringify(redisPayload));
    if (setResult) {
        // Set expiration only if the key was newly created, otherwise, do nothing
        await redisClientV4.expire(key, SSO_CONFIG.TRANSFER_TOKEN_TTL_SECONDS);
    }
    return token;
}

export async function consumeTransferToken(token: string): Promise<StoredSessionPayload | null> {
    const key = `sso:transfer:${token}`;
    const val = await redisClientV4.get(key);
    if (!val) return null;
    await redisClientV4.del(key); // single-use
    try {
        return JSON.parse(val) as StoredSessionPayload;
    } catch {
        return null;
    }
}

export async function loadOriginalSession(sessionId: string): Promise<StoredSessionData | null> {
    // Default connect-redis / express-session key pattern: sess:<sid> or stg_sess:<sid>
    const prefix = process.env.APP_ENV === "staging" ? "stg_sess" : "sess";
    const raw = await redisClientV4.get(`${prefix}:${sessionId}`);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as StoredSessionData;
    } catch {
        return null;
    }
}
