// import { Server } from "http";
// import "jest";
// import "jest-extended";
// import request from "supertest";
// import { redisClient } from "../../src/bootstrap/express";
// import logger from "../../src/bootstrap/logger";
// import UserDAO from "../../src/DAO/UserDAO";
// import User, { Role } from "../../src/models/user";
// import startServer from "../../src/bootstrap/app";
// import {doLogout, makeGetRequest, makeLoggedInRequest, makePostRequest, setupOwnerAndAdminUsers} from "./helpers";
// import { config as dotenvConfig } from "dotenv";
// import { resolve as resolvePath } from "path";
// dotenvConfig({path: resolvePath(__dirname, "../.env")});
//
// let app: Server;
// let ownerUser: User;
// let adminUser: User;
//
// async function shutdown() {
//     await new Promise(resolve => {
//         redisClient.quit(() => {
//             resolve();
//         });
//     });
//     // redis.quit() creates a thread to close the connection.
//     // We wait until all threads have been run once to ensure the connection closes.
//     await new Promise(resolve => setImmediate(resolve));
// }
//
// beforeAll(async () => {
//     logger.debug("~~~~~~EMAIL ROUTES BEFORE ALL~~~~~~");
//     app = await startServer();
//
//     // Create admin and owner users in db for rest of this suite's use
//     const userDAO = new UserDAO();
//     [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
// });
//
// afterAll(async () => {
//     logger.debug("~~~~~~EMAIL ROUTES AFTER ALL~~~~~~");
//     await shutdown();
//     app.close(() => {
//         logger.debug("CLOSED SERVER");
//     });
// });
//
// describe("Email API endpoints", () => {
//     const emailPostRequest = (email: string, url: string, status: number = 202) =>
//         (agent: request.SuperTest<request.Test>) =>
//             makePostRequest<{email: string}>(agent, `/email/${url}`, {email}, status);
//     const webhookPostRequest = (event: object, status: number = 200) =>
//         (agent: request.SuperTest<request.Test>) =>
//             makePostRequest<object>(agent, "/email/sendInMailWebhook", event, status);
//
//     describe("POST /resetEmail (send a reset password email)", () => {
//         it("should return a 202 message if the email is successfully queued", async () => {
//             await emailPostRequest(ownerUser.email, "resetEmail")(request(app));
//         });
//     });
//
//     describe("POST /ownerUser.email (send a test notification email)", () => {
//         it("should return a 202 message if the email is successfully queued", async () => {
//             await emailPostRequest(ownerUser.email, "testEmail")(request(app));
//         });
//     });
//
//     describe("POST /registrationEmail (send a registration email)", () => {
//         it("should return a 202 message if the email is successfully queued", async () => {
//             await emailPostRequest(ownerUser.email, "registrationEmail")(request(app));
//         });
//     });
//
//     describe("POST /sendInMailWebhook (receive a webhook response)", () => {
//         it("should return a 200 message if the email is successfully queued", async () => {
//             const webhookEvent = {
//                 event: "request",
//                 email: "example@example.com",
//                 id: 134503,
//                 date: "2020-04-11 00:13:02",
//                 ts: 1586556782,
//                 "message-id": "<5d0e2800bbddbd4ed05cc56a@domain.com>",
//                 ts_event: 1586556782,
//             };
//             await webhookPostRequest(webhookEvent)(request(app));
//         });
//     });
// });
