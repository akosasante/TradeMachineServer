import { User } from "@akosasante/trade-machine-models";
import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import server from "../../src/server";
import { UserFactory } from "../factories/UserFactory";
import { adminLoggedIn, doLogout, makeDeleteRequest, makeGetRequest, makePostRequest,
    makePutRequest, ownerLoggedIn, setupOwnerAndAdminUsers, stringifyQuery } from "./helpers";
import UserDO from "../../src/models/user";

let app: Server;
let ownerUser: UserDO;
let adminUser: UserDO;

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
    logger.debug("~~~~~~USER ROUTES BEFORE ALL~~~~~~");
    app = await server;

    // Create admin and owner users in db for rest of this suite's use
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
});

afterAll(async () => {
    logger.debug("~~~~~~USER ROUTES AFTER ALL~~~~~~");
    await shutdown();
    app.close(() => {
        logger.debug("CLOSED SERVER");
    });
});

describe("User API endpoints", () => {
    describe("POST /users (create new user)", () => {
        const jatheeshUser = UserFactory.getUser("jatheesh@example.com");
        const akosUser = UserFactory.getUser("akos@example.com");
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (userObj: Partial<UserDO>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<UserDO>>(agent, "/users", userObj, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single user object instance to the object passed in", async () => {
            const res = await adminLoggedIn(postRequest(jatheeshUser.parse()), app);
            expect(jatheeshUser.toUserModel() === (res.body)).toBeTrue();
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const invalidPropsObj = {
                ...akosUser.parse(),
                blah: "Hello",
                bloop: "yeeeah",
            };
            const res = await adminLoggedIn(postRequest(invalidPropsObj), app);
            expect(akosUser.equals(res.body)).toBeTrue();
        });
        it("should return a 400 Bad Request error if missing required property", async () => {
            const missingEmailUser = {displayName: "Jatheesh"};
            const res = await adminLoggedIn(postRequest(missingEmailUser, 400), app);
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 400 Bad Request error if user with this email already exists in db", async () => {
            const res = await adminLoggedIn(postRequest(jatheeshUser, 400), app);
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should throw a 403 Forbidden Error if a non-admin tries to create a user", async () => {
            await ownerLoggedIn(postRequest(jatheeshUser, 403), app);
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await postRequest(jatheeshUser, 403)(request(app));
        });
    });

    describe("GET /users (get all users)", () => {
        const getAllRequest = (status: number = 200) => makeGetRequest(request(app), "/users", status);

        it("should return an array of all the users in the db", async () => {
            const res = await getAllRequest();
            expect(res.body).toBeArrayOfSize(4);
            expect(adminUser.toUserModel() === (res.body[0])).toBeTrue();
        });
    });

    describe("GET /users?full= (get all users with teams)", () => {
        const getAllRequest = (full: boolean = true, status: number = 200) =>
            makeGetRequest(request(app), `/users?full=${full}`, status);

        it("should return an array of all the users with teams in the db if full=true", async () => {
            const res = await getAllRequest();
            expect(res.body).toBeArrayOfSize(4);
            expect(adminUser.toUserModel() === (res.body[0])).toBeTrue();
            expect(res.body[0]).toHaveProperty("team");
        });
        it("should return an array of all the users without teams in the db if full=false", async () => {
            const res = await getAllRequest(false );
            expect(res.body).toBeArrayOfSize(4);
            expect(adminUser.toUserModel() === (res.body[0])).toBeTrue();
            expect(res.body[0]).not.toHaveProperty("team");
        });
    });

    describe("GET /users/:id (get one user)", () => {
        const getOneRequest = (id: string, status: number = 200) =>
            makeGetRequest(request(app), `/users/${id}`, status);

        it("should return a single public user if logged in, no matter the role (ADMIN)", async () => {
            const res = await getOneRequest("1");
            expect(res.body).toBeObject();
            expect(adminUser.equals(res.body)).toBeTrue();
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            await getOneRequest("999", 404);
        });
    });

    describe("GET /users/search?queryOpts (get user by query)", () => {
        const findRequest = (query: any, status: number = 200) =>
            makeGetRequest(request(app), `/users/search${stringifyQuery(query)}`, status);

        it("should return a single public user for the given query", async () => {
            const res = await findRequest({ email: ownerUser.email });
            expect(res.body).toBeObject();
            expect(ownerUser.toUserModel() === (res.body)).toBeTrue();
        });
        it("should throw a 404 error if no user with that query is found", async () => {
            await findRequest({ email: "nonono@test.com" }, 404);
        });
        it("should return an array of users if given query includes the key 'multiple'", async () => {
            const res = await findRequest({email: ownerUser.email, multiple: "true"});
            expect(res.body).toBeArrayOfSize(1);
            expect(res.body[0]).toBeObject();
            expect(ownerUser.toUserModel() === (res.body[0])).toBeTrue();
        });
        it("should throw a 404 error if no users with that query are found (multiple)", async () => {
            await findRequest({ email: "nonono@test.com", multiple: "true" }, 404);
        });
    });

    describe("PUT /users/:id (update one user)", () => {
        const putRequest = (id: string, userObj: Partial<UserDO>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<UserDO>>(agent, `/users/${id}`, userObj, status);
        const getOneRequest = (id: string) => makeGetRequest(request(app), `/users/${id}`, 200);
        const slackUsername = "MrMeSeeks92";
        const updatedAdmin = UserFactory.getAdminUser();
        updatedAdmin.slackUsername = slackUsername;

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated user without a password", async () => {
            const res = await adminLoggedIn(putRequest(adminUser.id!, { slackUsername }), app);
            expect(updatedAdmin.toUserModel() === (res.body)).toBeTrue();

            // Confirm db was actually updated:
            const getOneRes = await getOneRequest(adminUser.id!);
            expect(updatedAdmin.toUserModel() === (getOneRes.body)).toBeTrue();
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const updatedObj = { email: "new@gmail.com", blah: "yo" };
            await adminLoggedIn(putRequest(adminUser.id!, updatedObj, 400), app);

            // Confirm db was NOT updated:
            const getOneRes = await getOneRequest(adminUser.id!);
            expect(updatedAdmin.toUserModel() === (getOneRes.body)).toBeTrue();
            expect(getOneRes.body.blah).toBeUndefined();
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            await adminLoggedIn(putRequest("999", { email: "whatever@gmail.com"  }, 404), app);
        });
        it("should throw a 403 Forbidden Error if a non-admin tries to update a user", async () => {
            await ownerLoggedIn(putRequest("1", { slackUsername: "hey" }, 403), app);
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await putRequest("1", { slackUsername: "Hey2" }, 403)(request(app));
        });
    });

    describe("DELETE /users/:id (delete one user)", () => {
        const deleteRequest = (id: string, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/users/${id}`, status);
        const getAllRequest = () => makeGetRequest(request(app), "/users", 200);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a delete result when logged in", async () => {
            const id = "4";
            const res = await adminLoggedIn(deleteRequest(id), app);
            expect(res.body).toEqual({ deleteCount: 1, id });

            // Confirm that one was deleted from db
            const getAllRes = await getAllRequest();
            expect(getAllRes.body).toBeArrayOfSize(3);
            expect(getAllRes.body.filter((user: User) => user.id === id)).toBeEmpty();
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            await adminLoggedIn(deleteRequest("999", 404), app);
        });
        it("should throw a 403 Forbidden Error if a non-admin tries to delete a user", async () => {
            await ownerLoggedIn(deleteRequest("1", 403), app);
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await deleteRequest("1", 403)(request(app));
        });
    });
});
