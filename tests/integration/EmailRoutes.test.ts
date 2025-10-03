import { Server } from "http";
import request from "supertest";
import logger from "../../src/bootstrap/logger";
import User from "../../src/models/user";
import startServer from "../../src/bootstrap/app";
import { clearPrismaDb, makePostRequest, setupOwnerAndAdminUsers } from "./helpers";
import initializeDb, { ExtendedPrismaClient } from "../../src/bootstrap/prisma-db";

let app: Server;
let ownerUser: User;

let prismaConn: ExtendedPrismaClient;
beforeAll(async () => {
    logger.debug("~~~~~~EMAIL ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    prismaConn = initializeDb(process.env.DB_LOGS === "true");
    return app;
}, 5000);

afterAll(async () => {
    // Only close the server instance for this test file
    // Shared infrastructure (Redis, Prisma) is cleaned up in globalTeardown
    if (app) {
        return new Promise<void>((resolve) => {
            app.close(() => {
                logger.debug("CLOSED SERVER");
                resolve();
            });
        });
    }
});

describe("Email API endpoints", () => {
    beforeEach(async () => {
        ownerUser = (await setupOwnerAndAdminUsers())[1];
        return ownerUser;
    });
    afterEach(async () => {
        return await clearPrismaDb(prismaConn);
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
        // assertion happens inside emailPostRequest
        // eslint-disable-next-line jest/expect-expect
        it("should return a 202 message if the email is successfully queued", async () => {
            await emailPostRequest(ownerUser.email, "testEmail")(request(app));
        });

        // assertion happens inside emailPostRequest
        // eslint-disable-next-line jest/expect-expect
        it("should return a 404 response if no user exists with the given email", async () => {
            await emailPostRequest("unknown@example.com", "testEmail", 404)(request(app));
        });
    });

    describe("POST /sendInMailWebhook (receive a webhook response)", () => {
        // assertion happens inside webhookPostRequest
        // eslint-disable-next-line jest/expect-expect
        it("should return a 200 message if the email is successfully queued", async () => {
            const webhookEvent = {
                event: "request",
                email: "example@example.com",
                id: 134503,
                date: "2020-04-11 00:13:02",
                ts: 1586556782,

                "message-id": "<5d0e2800bbddbd4ed05cc56a@domain.com>",
                ts_event: 1586556782,
            };
            await webhookPostRequest(webhookEvent)(request(app));
        });
    });
});
