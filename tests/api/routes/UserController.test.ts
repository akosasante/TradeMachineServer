import { config as dotenvConfig } from "dotenv";
import { Server } from "http";
import "jest";
import path from "path";
import request from "supertest";
import server from "../../../src/server";

dotenvConfig({path: path.resolve(__dirname, "../.env")});

describe("User endpoints", () => {
    let app: Server;
    const testMessages = {
        get: () => "getting all users",
        getOne: (id: number) => `get user with id: ${id}`,
        create: (user: User) => `creating new user ${user}`,
        update: (user: User) => `updating user with id ${user.id}, looks like: ${user}`,
        delete: (id: number) => `deleting user with id ${id}`,
    };
    interface User {
        id: number;
        name: string;
        email: string;
    }
    const testUser: User = {
        id: 1,
        name: "Testkosua Testsante",
        email: "test@example.com",
    };

    beforeAll(async () => {
        app = await server;
    });
    afterAll(async () => {
        // app.close();
    });
    describe("Get all users", () => {
        it("should return successfully", async () => {
            const res = await request(app)
                .get("/users")
                .expect(200);
            expect(res.body).toEqual(testMessages.get());
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
