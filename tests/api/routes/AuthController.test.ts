import { Server } from "http";
import request from "supertest";
import User from "../../../src/models/user";
import server from "../../../src/server";

describe("Auth endpoints", () => {
    let app: Server;
    const testUser: User = new User({
        id: 1,
        name: "Testkosua Testsante",
        email: "test@example.com",
    });

    beforeAll(async () => {
        app = await server;
    });
    afterAll(async () => {
        // app.close();
    });

    describe("Login", () => {
        it("should suceed", async () => {
            const res = await request(app)
                .post("/auth/login")
                .send(testUser)
                .expect(200);
        });
    });
});
