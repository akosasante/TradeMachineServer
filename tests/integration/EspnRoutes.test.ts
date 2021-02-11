import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import { adminLoggedIn, makeGetRequest, setupOwnerAndAdminUsers } from "./helpers";
import startServer from "../../src/bootstrap/app";
import User from "../../src/models/user";

let app: Server;
let adminUser: User;

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
    logger.debug("~~~~~~ESPN ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    [adminUser] = await setupOwnerAndAdminUsers();
});

afterAll(async () => {
    await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
});

describe("ESPN API endpoints", () => {
    describe("GET /espn/teams?year (get all ESPN teams)", () => {
        const getAllRequest = (year?: number, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => {
                const yearParam = year ? `?year=${year}` : "";
                return makeGetRequest(agent, `/espn/teams${yearParam}`, status);
            };

        it("should return all teams in the default year", async () => {
            const {body} = await adminLoggedIn(getAllRequest(), app);
            expect(body).toBeArray();
            // There are other keys, but these are the ones we definitely want to know if they're gone
            expect(body[0]).toContainKeys(["id", "abbrev", "location", "nickname", "owners", "divisionId", "isActive"]);
        }, 10000);

        it("should return all teams in a given year", async () => {
            const {body} = await adminLoggedIn(getAllRequest(2019), app);
            expect(body).toBeArray();
            expect(body[0]).toContainKeys(["id", "abbrev", "location", "nickname", "owners", "divisionId", "isActive"]);
        }, 10000);
    });

    describe("GET /espn/members?year (get all ESPN teams)", () => {
        const getAllRequest = (year?: number, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => {
                const yearParam = year ? `?year=${year}` : "";
                return makeGetRequest(agent, `/espn/members${yearParam}`, status);
            };

        it("should return all members in the default year", async () => {
            const {body} = await adminLoggedIn(getAllRequest(), app);
            expect(body).toBeArray();
            expect(body[0]).toContainAllKeys(["id", "isLeagueManager", "displayName"]);
        }, 10000);

        it("should return all members in a given year", async () => {
            const {body} = await adminLoggedIn(getAllRequest(2019), app);
            expect(body).toBeArray();
            expect(body[0]).toContainAllKeys(["id", "isLeagueManager", "displayName"]);
        }, 10000);
    });
});
