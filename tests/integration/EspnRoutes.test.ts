import "jest-extended";
import { Server } from "http";
import request from "supertest";
import logger from "../../src/bootstrap/logger";
import { adminLoggedIn, clearPrismaDb, makeGetRequest, ownerLoggedIn, setupOwnerAndAdminUsers } from "./helpers";
import startServer from "../../src/bootstrap/app";
import User from "../../src/models/user";
import initializeDb, { ExtendedPrismaClient } from "../../src/bootstrap/prisma-db";

let app: Server;
let adminUser: User;
let ownerUser: User;
let prismaConn: ExtendedPrismaClient;
beforeAll(async () => {
    logger.debug("~~~~~~ESPN ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    prismaConn = initializeDb(process.env.DB_LOGS === "true");
    return app;
}, 5000);

afterAll(async () => {
    // Only close the server instance for this test file
    // Shared infrastructure (Redis, Prisma) is cleaned up in globalTeardown
    if (app) {
        return new Promise<void>(resolve => {
            app.close(() => {
                logger.debug("CLOSED SERVER");
                resolve();
            });
        });
    }
});

describe("ESPN API endpoints", () => {
    beforeEach(async () => {
        [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
        return [adminUser, ownerUser];
    });
    afterEach(async () => {
        return await clearPrismaDb(prismaConn);
    });

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
            const { body } = await adminLoggedIn(getAllRequest(2025), app);
            expect(body).toBeArray();
            expect(body[0]).toContainKeys(["id", "abbrev", "name", "owners", "divisionId", "isActive"]);
        }, 10000);
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 403 Forbidden Error if a non-admin tries to call the endpoint", async () => {
            await ownerLoggedIn(getAllRequest(2025, 403), app);
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await getAllRequest(2025, 403)(request(app));
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

        // assertion happens inside api call helper function

        it("should return all members in a given year", async () => {
            const { body } = await adminLoggedIn(getAllRequest(2025), app);
            expect(body).toBeArray();
            expect(body[0]).toContainAllKeys(["id", "isLeagueManager", "displayName"]);
        }, 10000);
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 403 Forbidden Error if a non-admin tries to call the endpoint", async () => {
            await ownerLoggedIn(getAllRequest(2025, 403), app);
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 403 Forbidden Error if a non-logged-in request is used", async () => {
            await getAllRequest(2025, 403)(request(app));
        });
    });
});
