import { config as dotenvConfig } from "dotenv";
import { Server } from "http";
import "jest";
import path from "path";
import request from "supertest";
import util from "util";
import { redisClient } from "../../../src/bootstrap/express";
import logger from "../../../src/bootstrap/logger";
import User from "../../../src/models/user";
import server from "../../../src/server";

dotenvConfig({path: path.resolve(__dirname, "../.env")});

describe("User endpoints", () => {
    let app: Server;
    let loggedIn: request.SuperTest<request.Test>;

    const testMessages = {
        get: () => "getting all users",
        getOne: (id: number) => `get user with id: ${id}`,
        create: (user: User) => `creating new user ${user}`,
        update: (user: User) => `updating user with id ${user.id}, looks like: ${user}`,
        delete: (id: number) => `deleting user with id ${id}`,
    };
    const testUser: User = new User({
        id: 1,
        name: "Testkosua Testsante",
        email: "admin@example.com",
    });

    beforeAll(async () => {
        app = await server;
        loggedIn = request.agent(app);
        await loggedIn
            .post("/auth/login")
            .send(testUser)
            .expect(200);
    });
    afterAll(async () => {
        redisClient.quit();
    });

    describe("Get all users", () => {
        it("should return unauthorized error if not logged in", async () => {
            await request(app)
                .get("/users")
                .expect(404);
        });
        it("should return successfully if logged in", async () => {
            const res = await loggedIn
                .get("/users")
                .expect(200);

            expect(res.body).toEqual(testMessages.get());
            logger.debug(util.inspect(res));
        });
    });
    describe("Get user by id", () => {
        it("should return successfully", async () => {
            const res = await request(app)
                .get(`/users/${testUser.id}`)
                .expect(200);
            expect(res.body).toEqual(testMessages.getOne(testUser.id));
        });
    });
    describe("Create a user", () => {
        it("should return successfully", async () => {
            const res = await request(app)
                .post("/users")
                .send(testUser)
                .expect(200);
            logger.debug(util.inspect(res.body));
            expect(res.body).toEqual(testMessages.create(testUser));
        });
    });
    describe("Update a user", () => {
        it("should return successfully", async () => {
            const res = await request(app)
                .put(`/users/${testUser.id}`)
                .send(testUser)
                .expect(200);
            expect(res.body).toEqual(testMessages.update(testUser));
        });
    });
    describe("Delete a user", () => {
        it("should return successfully", async () => {
            const res = await request(app)
                .delete(`/users/${testUser.id}`)
                .expect(200);
            expect(res.body).toEqual(testMessages.delete(testUser.id));
        });
    });
});
