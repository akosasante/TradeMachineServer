import { Server } from "http";
import "jest";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import startServer from "../../src/bootstrap/app";

async function shutdown() {
    await new Promise(resolve => {
        redisClient.quit(() => {
            resolve();
        });
    });
    // redis.quit() creates a thread to close the connection.
    // We wait until all threads have been run once to ensure the connection closes.
    await new Promise(resolve => setImmediate(resolve));
}

describe("GET /random-url", () => {
    let app: Server;
    beforeAll(async () => {
        logger.debug("~~~~~~BASIC APP ROUTES BEFORE ALL~~~~~~");
        app = await startServer();
    });
    afterAll(async () => {
        logger.debug("~~~~~~BASIC APP ROUTES AFTEr ALL~~~~~~");
        await shutdown();
        if (app) {
            app.close(() => {
                logger.debug("CLOSED SERVER");
            });
        }
});
    it("should return 404", done => {
        request(app)
            .get("/blahblah")
            .expect(404, done);
    });
});
