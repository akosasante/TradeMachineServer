import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import User, { Role } from "../../src/models/user";
import server from "../../src/server";

describe("User API endpoints", () => {
    let app: Server;
    let adminLoggedIn: request.SuperTest<request.Test>;
    let ownerLoggedIn: request.SuperTest<request.Test>;
    const testUserObj = (email: string) => ({
        email,
        password: "lol",
        name: "Jatheesh",
        roles: [Role.OWNER],
    });
    const testUser = (email: string) => new User(testUserObj(email));
    const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
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
    let adminUser: User;
    let ownerUser: User;
    async function makeLoggedInRequest(agent: request.SuperTest<request.Test>, user: User,
                                       req: (ag: request.SuperTest<request.Test>) => any) {
        await agent
            .post("/auth/login")
            .send(user)
            .expect(200);
        return req(agent);
    }

    async function logoutAgent(agent: request.SuperTest<request.Test>) {
        await agent
            .post("/auth/logout")
            .send({})
            .expect(200);
    }

    beforeAll(async () => {
        app = await server;
        const adminRes = await request(app)
            .post("/users")
            .send(adminUserObj)
            .expect(200);
        const ownerRes = await request(app)
            .post("/users")
            .send(ownerUserObj)
            .expect(200);
        adminUser = new User(adminRes.body);
        ownerUser = new User(ownerRes.body);
    });
    afterAll(async () => {
        await redisClient.quit();
    });
    describe("POST /users (create new user)", () => {
        const postRequest = (userObj: Partial<User>) => request(app)
            .post("/users")
            .send(userObj)
            .expect("Content-Type", /json/)
            .expect(200);
        const badRequest = (userObj: Partial<User>) => request(app)
            .post("/users")
            .send(userObj)
            .expect("Content-Type", /json/)
            .expect(400);
        it("should return a single user object instance to the object passed in", async () => {
            const email = "jatheeshx@example.com";
            const res = await postRequest(testUserObj(email));
            expect(testUser(email).equals(res.body)).toBeTrue();
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const email = "invalid@gmail.com";
            const invalidPropsObj = {
                ...testUserObj(email),
                blah: "Hello",
                bloop: "yeeeah",
            };
            const res = await postRequest(invalidPropsObj);
            expect(testUser(email).equals(res.body)).toBeTrue();
        });
        it("should return a 400 Bad Request error if missing required property", async () => {
            const missingEmailUser = {name: "Jatheesh"};
            const res = await badRequest(missingEmailUser);
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 400 Bad Request error if user with this email already exists in db", async () => {
            const email = "jatheeshx@example.com";
            const res = await badRequest(testUserObj(email));
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
    });
    describe("GET /users (get all users)", () => {
        afterEach(async () => {
            await logoutAgent(request.agent(app));
        });
        const loggedInGetAll = (agent: request.SuperTest<request.Test>) => agent
            .get("/users")
            .expect("Content-Type", /json/);
        it("should return an array of all the users in the db", async () => {
            adminLoggedIn = request.agent(app);
            const adminRes = await makeLoggedInRequest(adminLoggedIn, adminUser, loggedInGetAll);
            const users = adminRes.body;
            expect(adminRes.status).toBe(200);
            expect(users).toBeArrayOfSize(4);
            expect(users).toSatisfyAll(user => User.isUser(user));
        });
        it("should return a 403 Forbidden Error if the user does not have the correct roles", async () => {
            ownerLoggedIn = request.agent(app);
            const ownerRes = await makeLoggedInRequest(ownerLoggedIn, ownerUser, loggedInGetAll);
            expect(ownerRes.status).toBe(403);
        });
        it("should return a 403 Forbidden Error if the user is not logged in at all", async () => {
            await request(app)
                .get("/users")
                .expect("Content-Type", /json/)
                .expect(403);
        });
    });
    describe("GET /users/:id (get one user)", () => {
        afterEach(async () => {
            await logoutAgent(request.agent(app));
        });
        const loggedInGetOne = (id: number) => (agent: request.SuperTest<request.Test>) => agent
            .get(`/users/${id}`)
            .expect("Content-Type", /json/);
        it("should return a single public user if logged in, no matter the role (ADMIN)", async () => {
            adminLoggedIn = request.agent(app);
            const adminRes = await makeLoggedInRequest(adminLoggedIn, adminUser, loggedInGetOne(1));
            expect(adminRes.status).toBe(200);
            expect(adminUser.equals(adminRes.body)).toBeTrue();
        });
        it("should return a single public user if logged in, no matter the role (OWNER)", async () => {
            ownerLoggedIn = request.agent(app);
            const ownerRes = await makeLoggedInRequest(ownerLoggedIn, ownerUser, loggedInGetOne(1));
            expect(ownerRes.status).toBe(200);
            expect(adminUser.equals(ownerRes.body)).toBeTrue();
        });
        it("should return a single public user if not logged in, since it's optional", async () => {
            const res = await request(app)
                .get("/users/1")
                .expect("Content-Type", /json/)
                .expect(200);
            expect(adminUser.equals(res.body)).toBeTrue();
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            await request(app)
                .get("/users/1000")
                .expect("Content-Type", /json/)
                .expect(404);
        });
    });
    describe("UPDATE /users/:id (update one user)", () => {
        it("should return the updated user without a password", async () => {
            const email = "updatedEmail@gmail.com";
            const updatedAdmin = new User({...adminUserObj, email});
            const res = await request(app)
                .put("/users/1")
                .send({email})
                .expect("Content-Type", /json/)
                .expect(200);
            expect(updatedAdmin.equals(res.body)).toBeTrue();
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const email = "new@gmail.com";
            const updatedAdmin = new User({...adminUserObj, email});
            await request(app)
                .put("/users/1")
                .send({email, nomnom: 1, namez: "HI"})
                .expect("Content-Type", /json/)
                .expect(400);
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            const email = "up2date@gmail.com";
            await request(app)
                .put("/users/1000000")
                .send({email})
                .expect("Content-Type", /json/)
                .expect(404);
        });
    });
    describe("DELETE /users/:id (delete one user)", () => {
        const loggedInDelete = (id: number) => (agent: request.SuperTest<request.Test>) => agent
            .delete(`/users/${id}`)
            .expect("Content-Type", /json/);
        it("should return a delete result when logged in", async () => {
            ownerLoggedIn = request.agent(app);
            const ownerRes = await makeLoggedInRequest(ownerLoggedIn, ownerUser, loggedInDelete(1));
            expect(ownerRes.status).toBe(200);
        });
        it("should throw a 404 Not Found error if there is no user with that ID", async () => {
            ownerLoggedIn = request.agent(app);
            const ownerRes = await makeLoggedInRequest(ownerLoggedIn, ownerUser, loggedInDelete(1000));
            expect(ownerRes.status).toBe(404);
        });
        it("should throw a 401 Unauthorized error if not logged in", async () => {
            await request(app)
                .delete("/users/2")
                .expect("Content-Type", /json/)
                .expect(401);
        });
    });
});
