import crypto from "crypto";
import { COOKIE_MAX_AGE_SECONDS, redisClient } from "../../../../bootstrap/express";
import { SessionData } from "express-session";
import logger from "../../../../bootstrap/logger";

interface StoredSessionPayload {
    sessionId: string;
    userId: string;
}

type StoredSessionData = Partial<SessionData>;

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const redisClientV4: typeof redisClient & {
    sAdd: (key: string, member: string) => Promise<number>;
    sMembers: (key: string) => Promise<string[]>;
} = redisClient.v4 as any;

const USER_SESSIONS_PREFIX = "user_sessions:";

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

/**
 * Registers a session ID in a per-user Redis Set so we can efficiently
 * find and destroy all sessions for a user without scanning all keys.
 */
export async function registerUserSession(userId: string, sessionId: string): Promise<void> {
    const key = `${USER_SESSIONS_PREFIX}${userId}`;
    await redisClientV4.sAdd(key, sessionId);
    await redisClientV4.expire(key, COOKIE_MAX_AGE_SECONDS);
}

export interface DestroySessionsResult {
    sessionsDestroyed: number;
    sessionsSkipped: number;
}

/**
 * Destroys all Redis sessions belonging to a specific user.
 * Uses a per-user Redis Set (populated by registerUserSession) for O(1)
 * lookup instead of scanning all keys with KEYS.
 *
 * Important: This function does NOT touch metrics - callers are responsible for
 * updating activeUserMetric and activeSessionsMetric appropriately.
 */
export async function destroyAllUserSessions(userId: string): Promise<DestroySessionsResult> {
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;
    const sessionIds = await redisClientV4.sMembers(userSessionsKey);

    if (!sessionIds || sessionIds.length === 0) {
        return { sessionsDestroyed: 0, sessionsSkipped: 0 };
    }

    const sessionPrefix = process.env.APP_ENV === "staging" ? "stg_sess:" : "sess:";
    const keysToDelete = sessionIds.map(sid => `${sessionPrefix}${sid}`);

    let sessionsDestroyed = 0;
    const results = await Promise.all(
        keysToDelete.map(key =>
            redisClientV4.del(key).catch(err => {
                logger.warn(`Failed to delete session key ${key}:`, err);
                return 0;
            })
        )
    );
    sessionsDestroyed = results.filter(r => r > 0).length;

    await redisClientV4.del(userSessionsKey);

    return {
        sessionsDestroyed,
        sessionsSkipped: sessionIds.length - sessionsDestroyed,
    };
}
