import "jest-extended";
import { Server } from "http";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import { adminLoggedIn, clearDb, makeGetRequest, ownerLoggedIn, setupOwnerAndAdminUsers } from "./helpers";
import startServer from "../../src/bootstrap/app";
import User from "../../src/models/user";
import { getConnection } from "typeorm";

let app: Server;
let adminUser: User;
let ownerUser: User;

async function shutdown() {
    try {
        await redisClient.disconnect();
    } catch (err) {
        logger.error(`Error while closing redis: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~ESPN ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    return app;
}, 5000);

afterAll(async () => {
    logger.debug("~~~~~~ESPN ROUTES AFTER ALL~~~~~~");
    const shutdownRedis = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownRedis;
});

describe("ESPN API endpoints", () => {
    beforeEach(async () => {
        [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
        return [adminUser, ownerUser];
    });
    afterEach(async () => {
        return await clearDb(getConnection(process.env.ORM_CONFIG));
    }, 40000);

    describe("GET /espn/teams?year (get all ESPN teams)", () => {
        const getAllRequest =
            (year?: number, status = 200) =>
            (agent: request.SuperTest<request.Test>) => {
                const yearParam = year ? `?year=${year}` : "";
                return makeGetRequest(agent, `/espn/teams${yearParam}`, status);
            };

        it("should return all teams in the default year", async () => {
            const { body } = await adminLoggedIn(getAllRequest(), app);
            expect(body).toBeArray();
            // There are other keys, but these are the ones we definitely want to know if they're gone
            expect(body[0]).toContainKeys(["id", "abbrev", "name", "owners", "divisionId", "isActive"]);
        }, 10000);

        it("should return all teams in a given year", async () => {
            const { body } = await adminLoggedIn(getAllRequest(2019), app);
            expect(body).toBeArray();
            expect(body[0]).toContainKeys(["id", "abbrev", "name", "owners", "divisionId", "isActive"]);
        }, 10000);
        it("should throw a 403 Forbidden Error if a non-admin tries to call the endpoint", async () => {
            await ownerLoggedIn(getAllRequest(2019, 403), app);
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await getAllRequest(2019, 403)(request(app));
        });
    });

    describe("GET /espn/members?year (get all ESPN teams)", () => {
        const getAllRequest =
            (year?: number, status = 200) =>
            (agent: request.SuperTest<request.Test>) => {
                const yearParam = year ? `?year=${year}` : "";
                return makeGetRequest(agent, `/espn/members${yearParam}`, status);
            };

        it("should return all members in the default year", async () => {
            const { body } = await adminLoggedIn(getAllRequest(), app);
            expect(body).toBeArray();
            expect(body[0]).toContainAllKeys(["id", "isLeagueManager", "displayName"]);
        }, 10000);

        it("should return all members in a given year", async () => {
            const { body } = await adminLoggedIn(getAllRequest(2019), app);
            expect(body).toBeArray();
            expect(body[0]).toContainAllKeys(["id", "isLeagueManager", "displayName"]);
        }, 10000);
        it("should throw a 403 Forbidden Error if a non-admin tries to call the endpoint", async () => {
            await ownerLoggedIn(getAllRequest(2019, 403), app);
        });
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await getAllRequest(2019, 403)(request(app));
        });
    });
});
