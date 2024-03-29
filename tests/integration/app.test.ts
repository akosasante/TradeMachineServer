import { Server } from "http";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import startServer from "../../src/bootstrap/app";

async function shutdown() {
    try {
        await redisClient.disconnect();
    } catch (err) {
        logger.error(`Error while closing redis: ${err}`);
    }
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
