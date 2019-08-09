import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import UserDAO from "../../src/DAO/UserDAO";
import User, { Role } from "../../src/models/user";
import server from "../../src/server";

let app: Server;
let userDAO: UserDAO;

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
    logger.debug("~~~~~~AUTH ROUTES BEFORE ALL~~~~~~");
    app = await server;
    userDAO = new UserDAO();
});
afterAll(async () => {
    logger.debug("~~~~~~AUTH ROUTES AFTER ALL~~~~~~");
    await shutdown();
    app.close(() => {
        logger.debug("CLOSED SERVER");
    });
});

describe("Auth API endpoints", () => {
    const testUserObj = {email: "test@example.com", password: "lol", roles: [Role.OWNER]};
    const testUser = new User(testUserObj);
    async function makeLoggedInRequest(agent: request.SuperTest<request.Test>,
                                       req: (ag: request.SuperTest<request.Test>) => any) {
        await agent
            .post("/auth/login")
            .send(testUser)
            .expect(200);
        return req(agent);
    }

    describe("POST /auth/signup", () => {
        it("should successfully signup the user, set up the session, and return the public user", async () => {
            const res = await request(app)
                .post("/auth/signup")
                .send(testUserObj)
                .expect(200);

            expect(testUser.equals(res.body)).toBeTrue();
            expect(res.body).not.toHaveProperty("password");
            expect(res.body.hasPassword).toBeTrue();
            expect(res.body.lastLoggedIn).toBeDefined();
        });
        it("should have created a new user upon signing up if the email wasn't in before", async () => {
            const users = await userDAO.getAllUsers();
            expect(users).toHaveLength(1);
        });
        it("should have updated just the password for an existing user with no password", async () => {
            const email = "test2@example.com";
            const password = "test";
            const noPassUser = await userDAO.createUser({email});
            expect(noPassUser.password).toBeFalsy();

            const res = await request(app)
                .post("/auth/signup")
                .send({ email, password })
                .expect(200);
            expect(res.body).not.toHaveProperty("password");
            expect(res.body.hasPassword).toBeTrue();
            expect(res.body.lastLoggedIn).toBeDefined();

            const updatedUser = await userDAO.getUserById(noPassUser.id!);
            expect(updatedUser.password).toBeDefined();
        });
        it("should not allow signing up with the same email", async () => {
            await request(app)
                .post("/auth/signup")
                .send({ email: testUser.email, password: "anotha one" })
                .expect(409);
        });
    });
    describe("POST /auth/login", () => {
        it("should successfully login the user, set up the session, and return the public user", async () => {
            const res = await request(app)
                .post("/auth/login")
                .send(testUserObj)
                .expect(200);
            expect(testUser.equals(res.body)).toBeTrue();
            expect(res.body).not.toHaveProperty("password");
            expect(res.body.lastLoggedIn).toBeDefined();
        });
        // TODO: Figure out what to test for when someone logs in to a new user from an existing session
    });
    describe("POST /auth/logout", () => {
        const logoutFunc = (agent: request.SuperTest<request.Test>) => agent.post("/auth/logout").expect(200);
        it("should successfully 'logout' a non-initialized session", async () => {
            await request(app)
                .post("/auth/logout")
                .expect(200);
        });
        it("should successfully logout the user and/ destroy session data", async () => {
            const loggedInAgent = request.agent(app);
            await makeLoggedInRequest(loggedInAgent, logoutFunc);
        });
    });
    describe("POST /auth/reset_password", () => {
        let user: User|undefined;
        beforeEach(async () => {
            await userDAO.setPasswordExpires(1);
            user = await userDAO.getUserById(1);
        });

        it("should successfully update the user with the hashed password", async () => {
            const resetPasswordObj = {id: user!.id, password: "newPass", token: user!.passwordResetToken!};
            const res = await request(app)
                .post("/auth/reset_password")
                .send(resetPasswordObj)
                .expect(200);
            expect(res.body).toEqual("success");
        });

        it("should return a 404 if there's no user with that passwordResetToken", async () => {
            const resetPasswordObj = {id: user!.id, password: "newPass", token: "xyz-uuid"};
            await request(app)
                .post("/auth/reset_password")
                .send(resetPasswordObj)
                .expect(404);
        });
    });
});
