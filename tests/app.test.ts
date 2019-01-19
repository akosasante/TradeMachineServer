import { config as dotenvConfig } from "dotenv";
import { Server } from "http";
import "jest";
import path from "path";
import request from "supertest";
import server from "../src/server";

dotenvConfig({path: path.resolve(__dirname, "../.env")});

describe("GET /random-url", () => {
    let app: Server;
    beforeAll(async () => {
        app = await server;
    });
    afterAll(async () => {
        // app.close();
    });
    it("should return 404", done => {
        request(app)
            .get("/blahblah")
            .expect(404, done);
    });
});
