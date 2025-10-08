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

// Session mapping for cross-domain logout
export async function storeSessionMapping(
    originalSessionId: string,
    newSessionId: string,
    _userId: string
): Promise<void> {
    const mappingTTL = 7 * 24 * 60 * 60; // 7 days (same as session lifetime)

    // Store bidirectional mapping so we can find either session from the other
    await Promise.all([
        redisClientV4.setEx(`sso:session_map:${originalSessionId}`, mappingTTL, newSessionId),
        redisClientV4.setEx(`sso:session_map:${newSessionId}`, mappingTTL, originalSessionId),
    ]);
}

export async function getRelatedSessionId(sessionId: string): Promise<string | null> {
    return await redisClientV4.get(`sso:session_map:${sessionId}`);
}

export async function destroyAllUserSessions(userId: string, currentSessionId: string): Promise<number> {
    const sessionPrefix = process.env.APP_ENV === "staging" ? "stg_sess" : "sess";
    const sessionsToDestroy = new Set<string>();

    // Always include the current session
    sessionsToDestroy.add(currentSessionId);

    try {
        // Use the efficient mapping lookup instead of scanning all sessions
        const relatedSessionId = await getRelatedSessionId(currentSessionId);
        if (relatedSessionId) {
            sessionsToDestroy.add(relatedSessionId);

            // Clean up the mapping keys since we're destroying both sessions
            await Promise.all([
                redisClientV4.del(`sso:session_map:${currentSessionId}`),
                redisClientV4.del(`sso:session_map:${relatedSessionId}`),
            ]);
        }
    } catch (mappingError) {
        // If mapping lookup fails, we'll still destroy the current session
        // Silent failure - mapping might not exist for single-session users
    }

    // Destroy all identified sessions
    const sessionKeys = Array.from(sessionsToDestroy).map(sessionId => `${sessionPrefix}:${sessionId}`);

    try {
        await Promise.all(sessionKeys.map(key => redisClientV4.del(key)));
        return sessionsToDestroy.size;
    } catch (error) {
        // Let the calling function handle logging
        throw error;
    }
}
