import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import server from "../../src/server";
import { makeGetRequest } from "./helpers";

let app: Server;

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
    app = await server;
});

afterAll(async () => {
    await shutdown();
});

describe("ESPN API endpoints", () => {
    describe("GET /espn/teams/:id/name (get a team's full name from its id)", () => {
        const getOneRequest = (id: number, status: number = 200) =>
            makeGetRequest(request(app), `/espn/teams/${id}/name`, status);

        it("should return the location + nickname for the given team ID", async () => {
            const res = await getOneRequest(20);
            expect(res.body).toEqual("Squirtle Squad");
        });

        it("should throw a 404 error if a team with that ID is not found", async () => {
            await getOneRequest(999, 404);
        });
    });
});
