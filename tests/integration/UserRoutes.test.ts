import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import UserDAO from "../../src/DAO/UserDAO";
import User, { Role } from "../../src/models/user";
import server from "../../src/server";
import {
    doLogout,
    makeDeleteRequest,
    makeGetRequest,
    makeLoggedInRequest,
    makePostRequest,
    makePutRequest,
    stringifyQuery
} from "./helpers";

describe("User API endpoints", () => {
    let app: Server;
    let ownerUser: User;
    const testUserObj = (email: string) => ({
        email,
        password: "lol",
        name: "Jatheesh",
        roles: [Role.OWNER],
    });
    const ADMIN_EMAIL = "admin@example.com";
    const OWNER_EMAIL = "owner@example.com";
    const adminUserObj = {
        ...testUserObj(ADMIN_EMAIL),
        roles: [Role.ADMIN],
    };
    const ownerUserObj = {
        ...testUserObj(OWNER_EMAIL),
        roles: [Role.OWNER],
    };
    const testUser = (email: string) => new User(testUserObj(email));
    const adminUser: User = new User(adminUserObj);

    const adminLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), adminUserObj.email, adminUserObj.password, requestFn);
    const ownerLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), ownerUserObj.email, ownerUserObj.password, requestFn);

    beforeAll(async () => {
        app = await server;
        const userDAO = new UserDAO();
        // Create admin and owner users in db for rest of this suite's use
        await userDAO.createUser({...adminUserObj});
        ownerUser = await userDAO.createUser({...ownerUserObj});
    });
    afterAll(async () => {
        await redisClient.quit();
    });

    describe("POST /users (create new user)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (userObj: Partial<User>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<User>>(agent, "/users", userObj, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single user object instance to the object passed in", async () => {
            const email = "jatheeshx@example.com";
            const res = await adminLoggedIn(postRequest(testUserObj(email)));
            expect((testUser(email).publicUser).equals(res.body)).toBeTrue();
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const email = "invalid@gmail.com";
            const invalidPropsObj = {
                ...testUserObj(email),
                blah: "Hello",
                bloop: "yeeeah",
            };
            const res = await adminLoggedIn(postRequest(invalidPropsObj));
            expect(testUser(email).equals(res.body)).toBeTrue();
        });
        it("should return a 400 Bad Request error if missing required property", async () => {
            const missingEmailUser = {name: "Jatheesh"};
            const res = await adminLoggedIn(postRequest(missingEmailUser, 400));
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 400 Bad Request error if user with this email already exists in db", async () => {
            const email = "jatheeshx@example.com";
            const res = await adminLoggedIn(postRequest(testUserObj(email), 400));
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should throw a 403 Forbidden Error if a non-admin tries to create a user", async () => {
            await ownerLoggedIn(postRequest(testUserObj("email@example.com"), 403));
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await postRequest(testUserObj("email@example.com"), 403)(request(app));
        });
    });

    describe("GET /users (get all users)", () => {
        const getAllRequest = (status: number = 200) => makeGetRequest(request(app), "/users", status);

        it("should return an array of all the users in the db", async () => {
            const res = await getAllRequest();
            expect(res.body).toBeArrayOfSize(4);
            expect(adminUser.publicUser.equals(res.body[0])).toBeTrue();
        });
    });

    describe("GET /users?full= (get all users with teams)", () => {
        const getAllRequest = (full: boolean = true, status: number = 200) =>
            makeGetRequest(request(app), `/users?full=${full}`, status);

        it("should return an array of all the users with teams in the db if full=true", async () => {
            const res = await getAllRequest();
            expect(res.body).toBeArrayOfSize(4);
            expect(adminUser.publicUser.equals(res.body[0])).toBeTrue();
            expect(res.body[0]).toHaveProperty("team");
        });
        it("should return an array of all the users without teams in the db if full=false", async () => {
            const res = await getAllRequest(false );
            expect(res.body).toBeArrayOfSize(4);
            expect(adminUser.publicUser.equals(res.body[0])).toBeTrue();
            expect(res.body[0]).not.toHaveProperty("team");
        });
    });

    describe("GET /users/:id (get one user)", () => {
        const getOneRequest = (id: number, status: number = 200) =>
            makeGetRequest(request(app), `/users/${id}`, status);

        it("should return a single public user if logged in, no matter the role (ADMIN)", async () => {
            const res = await getOneRequest(1);
            expect(res.body).toBeObject();
            expect(adminUser.equals(res.body)).toBeTrue();
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            await getOneRequest(999, 404);
        });
    });

    describe("GET /users/search?queryOpts (get user by query)", () => {
        const findRequest = (query: any, status: number = 200) =>
            makeGetRequest(request(app), `/users/search${stringifyQuery(query)}`, status);

        it("should return a single public user for the given query", async () => {
            const res = await findRequest({ email: ownerUserObj.email });
            expect(res.body).toBeObject();
            expect(ownerUser.publicUser.equals(res.body)).toBeTrue();
        });
        it("should throw a 404 error if no user with that query is found", async () => {
            await findRequest({ email: "nonono@test.com" }, 404);
        });
        it("should return an array of users if given query includes the key 'multiple'", async () => {
            const res = await findRequest({email: ownerUserObj.email, multiple: "true"});
            expect(res.body).toBeArrayOfSize(1);
            expect(res.body[0]).toBeObject();
            expect(ownerUser.publicUser.equals(res.body[0])).toBeTrue();
        });
        it("should throw a 404 error if no users with that query are found (multiple)", async () => {
            await findRequest({ email: "nonono@test.com", multiple: "true" }, 404);
        });
    });

    describe("UPDATE /users/:id (update one user)", () => {
        const putRequest = (id: number, userObj: Partial<User>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<User>>(agent, `/users/${id}`, userObj, status);
        const getOneRequest = (id: number) => makeGetRequest(request(app), `/users/${id}`, 200);
        const username = "MrMeSeeks92";
        const updatedAdmin = new User({...adminUserObj, username});
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated user without a password", async () => {
            const res = await adminLoggedIn(putRequest(1, { username }));
            expect(updatedAdmin.publicUser.equals(res.body)).toBeTrue();

            // Confirm db was actually updated:
            const getOneRes = await getOneRequest(1);
            expect(updatedAdmin.publicUser.equals(getOneRes.body)).toBeTrue();
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const updatedObj = { email: "new@gmail.com", blah: "yo" };
            await adminLoggedIn(putRequest(1, updatedObj, 400));

            // Confirm db was NOT updated:
            const getOneRes = await getOneRequest(1);
            expect(updatedAdmin.publicUser.equals(getOneRes.body)).toBeTrue();
            expect(getOneRes.body.blah).toBeUndefined();
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            const email = "up2date@gmail.com";
            await adminLoggedIn(putRequest(999, { email }, 404));
        });
        it("should throw a 403 Forbidden Error if a non-admin tries to update a user", async () => {
            await ownerLoggedIn(putRequest(1, { username: "hey" }, 403));
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await putRequest(1, { username: "Hey2" }, 403)(request(app));
        });
    });

    describe("DELETE /users/:id (delete one user)", () => {
        const deleteRequest = (id: number, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/users/${id}`, status);
        const getAllRequest = () => makeGetRequest(request(app), "/users", 200);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a delete result when logged in", async () => {
            const id = 4;
            const res = await adminLoggedIn(deleteRequest(id));
            expect(res.body).toEqual({ deleteResult: true, id });

            // Confirm that one was deleted from db
            const getAllRes = await getAllRequest();
            expect(getAllRes.body).toBeArrayOfSize(3);
            expect(getAllRes.body.filter((user: User) => user.id === id)).toBeEmpty();
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            await adminLoggedIn(deleteRequest(999, 404));
        });
        it("should throw a 403 Forbidden Error if a non-admin tries to delete a user", async () => {
            await ownerLoggedIn(deleteRequest(1, 403));
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await deleteRequest(1, 403)(request(app));
        });
    });
});
