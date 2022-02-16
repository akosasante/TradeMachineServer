import { Server } from "http";
import * as request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import User from "../../src/models/user";
import startServer from "../../src/bootstrap/app";
import { clearDb, makePostRequest, setupOwnerAndAdminUsers } from "./helpers";
import { getConnection } from "typeorm";

let app: Server;
let ownerUser: User;

async function shutdown() {
    try {
        await redisClient.disconnect();
    } catch (err) {
        logger.error(`Error while closing redis: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~EMAIL ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    return app;
}, 5000);

afterAll(async () => {
    logger.debug("~~~~~~EMAIL ROUTES AFTER ALL~~~~~~");
    const shutdownRedis = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownRedis;
});

describe("Email API endpoints", () => {
    beforeEach(async () => {
        ownerUser = (await setupOwnerAndAdminUsers())[1];
        return ownerUser;
    });
    afterEach(async () => {
        return await clearDb(getConnection(process.env.ORM_CONFIG));
    });

    const emailPostRequest =
        (email: string, url: string, status = 202) =>
        (agent: request.SuperTest<request.Test>) =>
            makePostRequest<{ email: string }>(agent, `/email/${url}`, { email }, status);
    const webhookPostRequest =
        (event: { [key: string]: string | number }, status = 200) =>
        (agent: request.SuperTest<request.Test>) =>
            makePostRequest<{ [key: string]: string | number }>(agent, "/email/sendInMailWebhook", event, status);

    describe("POST /testEmail (send a test notification email)", () => {
        it("should return a 202 message if the email is successfully queued", async () => {
            await emailPostRequest(ownerUser.email, "testEmail")(request(app));
        });

        it("should return a 404 response if no user exists with the given email", async () => {
            await emailPostRequest("unknown@example.com", "testEmail", 404)(request(app));
        });
    });

    describe("POST /sendInMailWebhook (receive a webhook response)", () => {
        it("should return a 200 message if the email is successfully queued", async () => {
            const webhookEvent = {
                event: "request",
                email: "example@example.com",
                id: 134503,
                date: "2020-04-11 00:13:02",
                ts: 1586556782,
                "message-id": "<5d0e2800bbddbd4ed05cc56a@domain.com>",
                // eslint-disable-next-line @typescript-eslint/naming-convention
                ts_event: 1586556782,
            };
            await webhookPostRequest(webhookEvent)(request(app));
        });
    });
});
