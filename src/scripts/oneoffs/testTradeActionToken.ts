// src/scripts/oneoffs/testTradeActionToken.ts
import "dotenv/config";
import { createClient } from "redis";
import crypto from "crypto";

// Mirror the same config as bootstrap/express.ts
const redis = createClient({
    legacyMode: true,
    socket: {
        host: process.env.REDIS_IP || "localhost",
        port: Number(process.env.REDIS_PORT || 6379),
        family: 4,
    },
    password: process.env.REDISPASS,
});

// The v4 interface (same pattern as tradeActionTokens.ts)
const redisV4 = redis.v4 as {
    setNX: (key: string, value: string) => Promise<boolean>;
    expire: (key: string, seconds: number) => Promise<boolean>;
    get: (key: string) => Promise<string | null>;
    del: (key: string) => Promise<number>;
};

const PREFIX = "trade-action:";
const TTL = 48 * 60 * 60;

async function main() {
    await redis.connect();
    console.log("Connected to Redis");

    // --- CREATE ---
    const token = crypto.randomBytes(32).toString("hex");
    const key = `${PREFIX}${token}`;
    const payload = { userId: "test-user-id", tradeId: "test-trade-id", action: "accept" };

    const setResult = await redisV4.setNX(key, JSON.stringify(payload));
    await redisV4.expire(key, TTL);
    console.log("Token created:", token);
    console.log("setNX result (should be true):", setResult);

    // --- VERIFY it exists ---
    const beforeConsume = await redisV4.get(key);
    console.log("Value before consume (should be JSON):", beforeConsume);

    // --- CONSUME ---
    await redisV4.del(key);
    const afterConsume = await redisV4.get(key);
    console.log("Value after consume (should be null):", afterConsume);

    // --- DOUBLE CONSUME (should be null) ---
    const secondConsume = await redisV4.get(key);
    console.log("Second consume (should be null):", secondConsume);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await redis.disconnect();
        console.log("Disconnected from Redis");
    });
