import { Server } from "http";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import startServer from "../../src/bootstrap/app";
import { UserFactory } from "../factories/UserFactory";
import User from "../../src/models/user";
import {
    adminLoggedIn,
    clearDb,
    DatePatternRegex,
    doLogout,
    makeDeleteRequest,
    makeGetRequest,
    makePostRequest,
    makePutRequest,
    ownerLoggedIn,
    setupOwnerAndAdminUsers,
    stringifyQuery,
} from "./helpers";
import { v4 as uuid } from "uuid";
import { getConnection } from "typeorm";
import UserDAO from "../../src/DAO/UserDAO";
import { inspect } from "util";

let app: Server;
let ownerUser: User;
let adminUser: User;
let userDao: UserDAO;

/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
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

beforeAll(async () => {
    logger.debug("~~~~~~USER ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    userDao = new UserDAO();

    return app;
}, 5000);

afterAll(async () => {
    logger.debug("~~~~~~USER ROUTES AFTER ALL~~~~~~");
    const shutdownRedis = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownRedis;
});

describe("User API endpoints", () => {
    beforeEach(async () => {
        // Create admin and owner users in db for rest of this suite's use
        [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
        logger.warn(`in befeeach: ${inspect(adminUser)} and ${inspect(ownerUser)}`);
        return [adminUser, ownerUser];
    });
    afterEach(async () => {
        return await clearDb(getConnection(process.env.NODE_ENV));
    });

    describe("POST /users (create new user)", () => {
        const jatheeshUser = UserFactory.getUser("jatheesh@example.com");
        const akosUser = UserFactory.getUser("akos@example.com");
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (userObj: Partial<User>, status = 200) => (agent: request.SuperTest<request.Test>) =>
            makePostRequest<Partial<User>>(agent, "/users", userObj, status);
        const getOneRequest = (id: string) => makeGetRequest(request(app), `/users/${id}`, 200);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return a list of user objects instance to the object(s) passed in", async () => {
            const { body } = await adminLoggedIn(postRequest([jatheeshUser.parse()]), app);
            const expected = {
                ...jatheeshUser,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
                password: undefined,
            };
            delete expected.password;

            expect(body[0]).toMatchObject(expected);
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const invalidPropsObj = {
                ...akosUser.parse(),
                blah: "Hello",
                bloop: "yeeeah",
            };
            const { body } = await adminLoggedIn(postRequest([invalidPropsObj]), app);
            const { body: getBody } = await getOneRequest(body[0].id);
            const expected = {
                ...akosUser,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
                password: undefined,
            };
            delete expected.password;

            expect(getBody).toMatchObject(expected);
            expect(getBody.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing required property", async () => {
            const missingEmailUser = { displayName: "Jatheesh" };
            const { body } = await adminLoggedIn(postRequest([missingEmailUser], 400), app);
            expect(body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 400 Bad Request error if user with this email already exists in db", async () => {
            await userDao.createUsers([UserFactory.getUser(jatheeshUser.email).parse()]);
            const { body } = await adminLoggedIn(postRequest([jatheeshUser.parse()], 400), app);
            expect(body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should throw a 403 Forbidden Error if a non-admin tries to create a user", async () => {
            await ownerLoggedIn(postRequest([jatheeshUser.parse()], 403), app);
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await postRequest([jatheeshUser.parse()], 403)(request(app));
        });
    });

    describe("GET /users (get all users)", () => {
        const getAllRequest = (status = 200) => makeGetRequest(request(app), "/users", status);

        it("should return an array of all the users in the db", async () => {
            // admin and owner user are inserted in beforeEach block; here we insert two additional users
            await userDao.createUsers([UserFactory.getUser("akos@example.com"), UserFactory.getUser()]);
            const { body } = await getAllRequest();
            expect(body).toBeArrayOfSize(4);
            const returnedAdmin = body.find((user: User) => user.id === adminUser.id);
            expect(returnedAdmin).toMatchObject({
                ...adminUser,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            });
            expect(returnedAdmin.password).toBeUndefined();
        });
    });

    describe("GET /users?full= (get all users with teams)", () => {
        const getAllRequest = (full = true, status = 200) =>
            makeGetRequest(request(app), `/users?full=${full}`, status);

        it("should return an array of all the users with teams in the db if full=true", async () => {
            // admin and owner user are inserted in beforeEach block; here we insert two additional users
            await userDao.createUsers([UserFactory.getUser("akos@example.com"), UserFactory.getUser()]);

            const { body } = await getAllRequest();
            expect(body).toBeArrayOfSize(4);
            const returnedAdmin = body.find((user: User) => user.id === adminUser.id);
            expect(returnedAdmin).toMatchObject({
                ...adminUser,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            });
            expect(returnedAdmin).toHaveProperty("team");
            expect(returnedAdmin.password).toBeUndefined();
        });

        it("should return an array of all the users without teams in the db if full=false", async () => {
            // admin and owner user are inserted in beforeEach block; here we insert two additional users
            await userDao.createUsers([UserFactory.getUser("akos@example.com"), UserFactory.getUser()]);

            const { body } = await getAllRequest(false);
            expect(body).toBeArrayOfSize(4);
            const returnedAdmin = body.find((user: User) => user.id === adminUser.id);
            expect(returnedAdmin).toMatchObject({
                ...adminUser,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            });
            expect(returnedAdmin).not.toHaveProperty("team");
            expect(returnedAdmin.password).toBeUndefined();
        });
    });

    describe("GET /users/:id (get one user)", () => {
        const getOneRequest = (id: string, status = 200) => makeGetRequest(request(app), `/users/${id}`, status);

        it("should return a single public user if logged in, no matter the role (ADMIN)", async () => {
            const { body } = await getOneRequest(adminUser.id!);
            expect(body).toBeObject();
            expect(body).toMatchObject({
                ...adminUser,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            });
            expect(body.password).toBeUndefined();
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            await getOneRequest(uuid(), 404);
        });
    });

    describe("GET /users/search?queryOpts (get user by query)", () => {
        const findRequest = (query: any, status = 200) =>
            makeGetRequest(request(app), `/users/search${stringifyQuery(query)}`, status);

        it("should return a single public user for the given query", async () => {
            const { body } = await findRequest({ query: { email: ownerUser.email } });
            expect(body).toBeObject();
            expect(body).toMatchObject({
                ...ownerUser,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            });
            expect(body.password).toBeUndefined();
        });
        it("should throw a 404 error if no user with that query is found", async () => {
            await findRequest({ query: { email: "nonono@test.com" } }, 404);
        });
        it("should return an array of users if given query includes the key 'multiple'", async () => {
            const { body } = await findRequest({ query: { email: ownerUser.email }, multiple: "true" });
            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toBeObject();
            expect(body[0]).toMatchObject({
                ...ownerUser,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            });
            expect(body[0].password).toBeUndefined();
        });
        it("should throw a 404 error if no users with that query are found (multiple)", async () => {
            await findRequest({ query: { email: "nonono@test.com" }, multiple: "true" }, 404);
        });
    });

    describe("PUT /users/:id (update one user)", () => {
        const putRequest = (id: string, userObj: Partial<User>, status = 200) => (
            agent: request.SuperTest<request.Test>
        ) => makePutRequest<Partial<User>>(agent, `/users/${id}`, userObj, status);
        const getOneRequest = (id: string) => makeGetRequest(request(app), `/users/${id}`, 200);
        const slackUsername = "MrMeSeeks92";
        const updatedAdmin = (admin: User) => ({ ...admin, slackUsername });
        logger.warn(`in descr: ${inspect(adminUser)}`);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return the updated user", async () => {
            logger.warn("TEST OF INTEREST");
            logger.warn(`in test admin: ${inspect(adminUser)}`);
            logger.warn(`in test updated: ${inspect(updatedAdmin(adminUser))}`);
            const all = await userDao.getAllUsers();
            logger.warn(inspect(all));
            const { body } = await adminLoggedIn(putRequest(adminUser.id!, { slackUsername }), app);
            logger.warn(inspect(body));
            expect(body).toMatchObject({
                ...updatedAdmin(adminUser),
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
                lastLoggedIn: expect.stringMatching(DatePatternRegex),
            });

            // Confirm db was actually updated:
            const { body: getOneBody } = await getOneRequest(adminUser.id!);
            logger.warn(inspect(getOneBody));
            const expected = {
                ...updatedAdmin(adminUser),
                password: expect.any(String),
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
                lastLoggedIn: expect.stringMatching(DatePatternRegex),
            };
            delete expected.password;
            expect(getOneBody).toMatchObject(expected);
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const updatedObj = { email: "new@gmail.com", blah: "yo" };
            await adminLoggedIn(putRequest(adminUser.id!, updatedObj, 400), app);

            // Confirm db was NOT updated:
            const { body: getOneRes } = await getOneRequest(adminUser.id!);
            const expected = {
                ...adminUser,
                password: expect.any(String),
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
                lastLoggedIn: expect.stringMatching(DatePatternRegex),
            };
            delete expected.password;
            expect(getOneRes).toMatchObject(expected);

            expect(getOneRes.blah).toBeUndefined();
            expect(getOneRes.slackUsername).toBeNull();
            expect(getOneRes.email).toEqual(adminUser.email);
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            await adminLoggedIn(putRequest(uuid(), { email: "whatever@gmail.com" }, 404), app);
        });
        it("should throw a 403 Forbidden Error if a non-admin tries to update a user", async () => {
            await ownerLoggedIn(putRequest(uuid(), { slackUsername: "hey" }, 403), app);
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await putRequest(uuid(), { slackUsername: "Hey2" }, 403)(request(app));
        });
    });

    describe("DELETE /users/:id (delete one user)", () => {
        const deleteRequest = (id: string, status = 200) => (agent: request.SuperTest<request.Test>) =>
            makeDeleteRequest(agent, `/users/${id}`, status);
        const getAllRequest = () => makeGetRequest(request(app), "/users", 200);
        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return a delete result when logged in", async () => {
            // admin and owner user are inserted in beforeEach block; here we insert two additional users
            await userDao.createUsers([UserFactory.getUser("akos@example.com"), UserFactory.getUser()]);

            const { body: getAllBefore } = await getAllRequest();
            const deletableUser = getAllBefore.filter(
                (user: User) => user.id !== adminUser.id! && user.id !== ownerUser.id!
            )[0];
            expect(getAllBefore).toBeArrayOfSize(4);

            const res = await adminLoggedIn(deleteRequest(deletableUser.id!), app);
            expect(res.body).toEqual({ deleteCount: 1, id: deletableUser.id! });

            // Confirm that one was deleted from db
            const { body: getAllRes } = await getAllRequest();
            expect(getAllRes).toBeArrayOfSize(3);
            expect(getAllRes.filter((user: User) => user.id === deletableUser.id!)).toBeEmpty();
        }, 2000);
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            await adminLoggedIn(deleteRequest(uuid(), 404), app);
        });
        it("should throw a 403 Forbidden Error if a non-admin tries to delete a user", async () => {
            await ownerLoggedIn(deleteRequest(uuid(), 403), app);
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await deleteRequest(uuid(), 403)(request(app));
        });
    });
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
