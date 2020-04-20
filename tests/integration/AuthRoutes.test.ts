import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import UserDAO from "../../src/DAO/UserDAO";
import User, { Role } from "../../src/models/user";
import startServer from "../../src/bootstrap/app";
import { config as dotenvConfig } from "dotenv";
import path from "path";
import { makeLoggedInRequest } from "./helpers";
dotenvConfig({path: path.resolve(__dirname, "../.env")});


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
    app = await startServer();
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
    const testUser = { email: "test@example.com", password: "lol" };

    describe("POST /auth/signup", () => {
        it("should successfully signup the user, set up the session, and return the public user", async () => {
            const {body} = await request(app)
                .post("/auth/signup")
                .send({email: testUser.email, password: testUser.password})
                .expect(200);

            expect(body.email).toEqual(testUser.email);
            expect(body).not.toHaveProperty("password");
            expect(body.lastLoggedIn).toBeDefined();
        });
        it("should have created a new user upon signing up if the email wasn't in before", async () => {
            const users = await userDAO.getAllUsers();
            expect(users).toHaveLength(1);
        });
        it("should have updated just the password for an existing user with no password", async () => {
            const email = "test2@example.com";
            const password = "test";
            await userDAO.createUsers([{email}]);
            const noPassUser = await userDAO.findUserWithPassword({email});
            expect(noPassUser!.password).toBeFalsy();

            const {body} = await request(app)
                .post("/auth/signup")
                .send({ email, password })
                .expect(200);
            expect(body).not.toHaveProperty("password");
            expect(body.lastLoggedIn).toBeDefined();

            const updatedUser = await userDAO.findUserWithPassword({email});
            expect(updatedUser!.password).toBeDefined();
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
            const {body} = await request(app)
                .post("/auth/login")
                .send({email: testUser.email, password: testUser.password})
                .expect(200);
            expect(body.email).toEqual(testUser.email);
            expect(body).not.toHaveProperty("password");
            expect(body.lastLoggedIn).toBeDefined();
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
            await makeLoggedInRequest(request.agent(app), testUser.email, testUser.password, logoutFunc);
        });
    });

    describe("POST /auth/reset_password", () => {
        let user: User|undefined;
        beforeAll(async () => {
            const getUser = await userDAO.findUserWithPassword({email: testUser.email});
            await userDAO.setPasswordExpires(getUser!.id!);
            user = await userDAO.getUserById(getUser!.id!);
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
