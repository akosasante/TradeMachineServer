import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import UserDAO from "../../src/DAO/UserDAO";
import User, { Role } from "../../src/models/user";
import server from "../../src/server";
import { doLogout, makeGetRequest, makeLoggedInRequest, makePostRequest } from "./helpers";

let app: Server;
let ownerLoggedIn: (fn: (ag: request.SuperTest<request.Test>) => any) => Promise<any>;
let adminLoggedIn: (fn: (ag: request.SuperTest<request.Test>) => any) => Promise<any>;

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

beforeAll(async () => {
    let ownerUser: User;
    let adminUser: User;
    app = await server;

    const userDAO = new UserDAO();
    const testPassword = "lol";
    ownerUser = await userDAO.createUser({
        email: "owner@example.com", password: testPassword, name: "Cam", roles: [Role.OWNER],
    });
    ownerLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), ownerUser.email!, testPassword, requestFn);
    adminUser = await userDAO.createUser({
        email: "admin@example.com", password: testPassword, name: "Cam", roles: [Role.ADMIN],
    });
    adminLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), adminUser.email!, testPassword, requestFn);
});

afterAll(async () => {
    await shutdown();
});

describe("Email API endpoints", () => {
    const emailPostRequest = (email: string, url: string, status: number = 202) =>
        (agent: request.SuperTest<request.Test>) =>
            makePostRequest<{email: string}>(agent, `/email/${url}`, {email}, status);
    const testEmail = "owner@example.com";

    describe("POST /resetEmail (send a reset password email)", () => {
        it("should return a 202 message if the email is successfully queued", async () => {
            await emailPostRequest(testEmail, "resetEmail")(request(app));
        });
    });

    describe("POST /testEmail (send a test notification email)", () => {
        it("should return a 202 message if the email is successfully queued", async () => {
            await emailPostRequest(testEmail, "testEmail")(request(app));
        });
    });

    describe("POST /registrationEmail (send a registration email)", () => {
        it("should return a 202 message if the email is successfully queued", async () => {
            await emailPostRequest(testEmail, "registrationEmail")(request(app));
        });
    });

    describe("GET /:id/status (check on the status of an email by messageID)", () => {
        const testMessageId = "<201906150242.34408309655@smtp-relay.sendinblue.com>";
        const messageStatusRequest = (messageId: string, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makeGetRequest(agent, `/email/${messageId}/status`, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });
        it("should return a JSON repr of the the events with that message ID", async () => {
            const res = await adminLoggedIn(messageStatusRequest(testMessageId));
            expect(res.body).toBeObject();
            expect(res.body.id).toEqual(testMessageId);
            expect(res.body.events).toBeArray();
        });
        it("should return a 403 Forbidden error if a non-admin user requests", async () => {
            await ownerLoggedIn(messageStatusRequest(testMessageId, 403));
        });
        it("should return a 403 Forbidden error if a non-logged in request is use", async () => {
            await messageStatusRequest(testMessageId, 403)(request(app));
        });
    });
});
