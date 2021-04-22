import { Server } from "http";
// @ts-ignore
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import startServer from "../../src/bootstrap/app";

async function shutdown() {
    await new Promise<void>((resolve, reject) => {
        redisClient.quit((err, reply) => {
            if (err) {
                reject(err);
            } else {
                logger.debug(`Redis quit successfully with reply ${reply}`);
                resolve();
            }
        });
    });
    // redis.quit() creates a thread to close the connection.
    // We wait until all threads have been run once to ensure the connection closes.
    return await new Promise(resolve => setImmediate(resolve));
}

describe("GET /random-url", () => {
    let app: Server;
    beforeAll(async () => {
        logger.debug("~~~~~~BASIC APP ROUTES BEFORE ALL~~~~~~");
        app = await startServer();
        return app;
    });
    afterAll(async () => {
        logger.debug("~~~~~~BASIC APP ROUTES AFTER ALL~~~~~~");
        const shutdownRedis = await shutdown();
        if (app) {
            app.close(() => {
                logger.debug("CLOSED SERVER");
            });
        }
        return shutdownRedis;
    });

    it("should return 404", async () => {
        await request(app).get("/blahblah").expect(404);
    }, 2000);
});
