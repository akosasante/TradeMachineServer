import { Server } from "http";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import UserDAO from "../../src/DAO/UserDAO";
import User, { TIME_TO_EXPIRE_USER_PASSWORD_IN_MS } from "../../src/models/user";
import startServer from "../../src/bootstrap/app";
import { clearDb, makeLoggedInRequest, makePostRequest } from "./helpers";
import { getConnection } from "typeorm";
import { generateHashedPassword } from "../../src/authentication/auth";
import { advanceBy, clear } from "jest-date-mock";

let app: Server;
let userDAO: UserDAO;
async function shutdown() {
    try {
        await redisClient.disconnect();
    } catch (err) {
        logger.error(`Error while closing redis: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~AUTH ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    userDAO = new UserDAO();
    return app;
});
afterAll(async () => {
    logger.debug("~~~~~~AUTH ROUTES AFTER ALL~~~~~~");
    const shutdownRedis = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownRedis;
});

describe("Auth API endpoints", () => {
    const testUser = { email: "test@example.com", password: "lol" };

    afterEach(async () => {
        return await clearDb(getConnection(process.env.ORM_CONFIG));
    }, 40000);

    describe("POST /auth/signup", () => {
        const signupRequest =
            (email: string, password: string, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<User>>(agent, "/auth/signup", { email, password }, status);

        it("should successfully signup the user, set up the session, and return the public user", async () => {
            const { body } = await signupRequest(testUser.email, testUser.password)(request(app));

            expect(body.email).toEqual(testUser.email);
            expect(body).not.toHaveProperty("password");
            expect(body.lastLoggedIn).toBeDefined();
        }, 2500);
        it("should have created a new user upon signing up if the email wasn't in before", async () => {
            await signupRequest(testUser.email, testUser.password)(request(app));

            const users = await userDAO.getAllUsers();
            expect(users).toHaveLength(1);
        });
        it("should have updated just the password for an existing user with no password", async () => {
            // Create user directly in db, with just email
            await userDAO.createUsers([{ email: testUser.email }]);

            const noPassUser = await userDAO.findUserWithPasswordByEmail(testUser.email);
            expect(noPassUser!.password).toBeFalsy();

            // Sign up user
            const { body } = await signupRequest(testUser.email, testUser.password)(request(app));
            expect(body).not.toHaveProperty("password");
            expect(body.lastLoggedIn).toBeDefined();

            // Check that user password is now set
            const updatedUser = await userDAO.findUserWithPasswordByEmail(testUser.email);
            expect(updatedUser!.password).toBeDefined();
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should not allow signing up with the same email for an existing user that already has a password", async () => {
            const hashedPass = await generateHashedPassword(testUser.password);
            await userDAO.createUsers([{ email: testUser.email, password: hashedPass }]);

            await signupRequest(testUser.email, "anotha one", 409)(request(app));
        });
    });

    describe("POST /auth/login", () => {
        const testUser2 = { email: "test2@example.com", password: testUser.password };

        beforeEach(async () => {
            const hashedPass = await generateHashedPassword(testUser.password);
            return await userDAO.createUsers([
                { email: testUser.email, password: hashedPass },
                {
                    email: testUser2.email,
                    password: hashedPass,
                },
            ]);
        });

        it("should successfully login the user, set up the session, and return the public user", async () => {
            const { body } = await request(app)
                .post("/auth/login")
                .send({ email: testUser.email, password: testUser.password })
                .expect(200);
            expect(body.email).toEqual(testUser.email);
            expect(body).not.toHaveProperty("password");
            expect(body.lastLoggedIn).toBeDefined();
        });

        it("should successfully login the user with case-insensitive email matching", async () => {
            const { body } = await request(app)
                .post("/auth/login")
                .send({ email: testUser.email.toLocaleUpperCase(), password: testUser.password })
                .expect(200);
            expect(body.email).toEqual(testUser.email);
            expect(body).not.toHaveProperty("password");
            expect(body.lastLoggedIn).toBeDefined();
        });

        it("should use the most recently logged in user credentials in the session (if somehow someone logs into a new user from an existing session", async () => {
            const sessionCheckFn = (agent: request.SuperTest<request.Test>) =>
                agent.get("/auth/session_check").expect(200);

            const { body: user1 } = await makeLoggedInRequest(
                request.agent(app),
                testUser.email,
                testUser.password,
                sessionCheckFn
            );
            expect(user1.email).toEqual(testUser.email);
            expect(user1).not.toHaveProperty("password");
            expect(user1.lastLoggedIn).toBeDefined();

            const { body: user2 } = await makeLoggedInRequest(
                request.agent(app),
                testUser2.email,
                testUser2.password,
                sessionCheckFn
            );
            expect(user2.email).toEqual(testUser2.email);
            expect(user2).not.toHaveProperty("password");
            expect(user2.lastLoggedIn).toBeDefined();
        });
    });

    describe("POST /auth/logout", () => {
        const logoutFunc = (agent: request.SuperTest<request.Test>) => agent.post("/auth/logout").expect(200);

        beforeEach(async () => {
            const hashedPass = await generateHashedPassword(testUser.password);
            return await userDAO.createUsers([{ email: testUser.email, password: hashedPass }]);
        });

        it("should successfully 'logout' a non-initialized session", async () => {
            await request(app).post("/auth/logout").expect(200);
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should successfully logout the user and/ destroy session data", async () => {
            await makeLoggedInRequest(request.agent(app), testUser.email, testUser.password, logoutFunc);
        });
    });

    describe("POST /auth/reset_password", () => {
        beforeEach(async () => {
            const hashedPass = await generateHashedPassword(testUser.password);
            return await userDAO.createUsers([{ email: testUser.email, password: hashedPass }]);
        });
        afterEach(() => clear());

        it("should successfully update the user with the hashed password", async () => {
            const { id } = (await userDAO.findUser({ email: testUser.email }, true)) as User;
            const { passwordResetToken } = await userDAO.setPasswordExpires(id!);
            const resetPasswordObj = { id, token: passwordResetToken, password: "newPass" };

            const res = await request(app).post("/auth/reset_password").send(resetPasswordObj).expect(200);
            expect(res.body).toBe("success");
        });

        it("should return a 404 if there's no user with that passwordResetToken", async () => {
            const { id } = (await userDAO.findUser({ email: testUser.email }, true)) as User;
            const resetPasswordObj = { id, token: "xyz-uuid", password: "newPass" };

            await request(app).post("/auth/reset_password").send(resetPasswordObj).expect(404);
        });

        it("should return a 403 if there's trying to reset a password past the expiry time", async () => {
            const { id } = (await userDAO.findUser({ email: testUser.email }, true)) as User;
            const { passwordResetToken } = await userDAO.setPasswordExpires(id!);
            const resetPasswordObj = { id, token: passwordResetToken, password: "newPass" };

            advanceBy(TIME_TO_EXPIRE_USER_PASSWORD_IN_MS + 1000);

            await request(app).post("/auth/reset_password").send(resetPasswordObj).expect(403);
        });
    });

    describe("POST /auth/login/sendResetEmail (send a reset password email)", () => {
        beforeEach(async () => {
            const hashedPass = await generateHashedPassword(testUser.password);
            return await userDAO.createUsers([{ email: testUser.email, password: hashedPass }]);
        });

        it("should return a 202 message if the email is successfully queued", async () => {
            await request(app).post("/auth/login/sendResetEmail").send({ email: testUser.email }).expect(202);
        });
    });

    describe("POST /auth/signup/sendEmail (send a registration email)", () => {
        beforeEach(async () => {
            const hashedPass = await generateHashedPassword(testUser.password);
            return await userDAO.createUsers([{ email: testUser.email, password: hashedPass }]);
        });

        it("should return a 202 message if the email is successfully queued", async () => {
            await request(app).post("/auth/signup/sendEmail").send({ email: testUser.email }).expect(202);
        });
    });

    describe("GET /auth/session_check", () => {
        const sessionCheckFn = (agent: request.SuperTest<request.Test>) => agent.get("/auth/session_check").expect(200);

        beforeEach(async () => {
            const hashedPass = await generateHashedPassword(testUser.password);
            return await userDAO.createUsers([{ email: testUser.email, password: hashedPass }]);
        });

        // eslint-disable-next-line jest/expect-expect
        it("should return a 200 if a logged in user calls the endpoint", async () => {
            await makeLoggedInRequest(request.agent(app), testUser.email, testUser.password, sessionCheckFn);
        });

        it("should return a 403 error if a non-logged in user calls the endpoint", async () => {
            await request(app).get("/auth/session_check").expect(403);
        });
    });
});
