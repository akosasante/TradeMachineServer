import { Server } from "http";
import request from "supertest";
import logger from "../../src/bootstrap/logger";
import startServer from "../../src/bootstrap/app";

describe("GET /random-url", () => {
    let app: Server;
    beforeAll(async () => {
        logger.debug("~~~~~~BASIC APP ROUTES BEFORE ALL~~~~~~");
        app = await startServer();
        return app;
    });
    afterAll(async () => {
        logger.debug("~~~~~~BASIC APP ROUTES AFTER ALL~~~~~~");
        // Only close the server instance for this test file
        // Shared infrastructure (Redis, Prisma) is cleaned up in globalTeardown
        if (app) {
            return new Promise<void>(resolve => {
                app.close(() => {
                    logger.debug("CLOSED SERVER");
                    resolve();
                });
            });
        }
    });

    it("should return 404", async () => {
        await request(app).get("/blahblah").expect(404);
    }, 2000);
});
