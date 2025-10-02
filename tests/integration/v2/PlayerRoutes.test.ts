import { Server } from "http";
import request from "supertest";
import "jest-extended";
import logger from "../../../src/bootstrap/logger";
import initializeDb, { ExtendedPrismaClient } from "../../../src/bootstrap/prisma-db";
import startServer from "../../../src/bootstrap/app";
import { clearPrismaDb, makeGetRequest, setupOwnerAndAdminUsers } from "../helpers";
import { Player } from "@prisma/client";
import User from "../../../src/models/user";
import { PlayerFactory } from "../../factories/PlayerFactory";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import PlayerModel, { PlayerLeagueType } from "../../../src/models/player";
import { handleExitInTest, registerCleanupCallback } from "../../../src/bootstrap/shutdownHandler";

let app: Server;
let prismaConn: ExtendedPrismaClient;
/* eslint-disable @typescript-eslint/no-unused-vars */
let ownerUser: User;
let adminUser: User;
/* eslint-enable @typescript-eslint/no-unused-vars */
let playerDao: PlayerDAO;

async function shutdown() {
    try {
        await handleExitInTest();
    } catch (err) {
        logger.error(`Error while shutting down: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~[V2] PLAYER ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    logger.debug("server started");
    prismaConn = initializeDb(process.env.DB_LOGS === "true");
    logger.debug("prisma conn started");
    // Create admin and owner users in db for rest of this suite's use
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
    logger.debug("users created");

    playerDao = new PlayerDAO();

    return app;
    // TODO: Hopefully we can remove the timeout after not relying on TypeORM
}, 40000);

afterAll(async () => {
    logger.debug("~~~~~~[V2] PLAYER ROUTES AFTER ALL~~~~~~");
    const shutdownResult = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownResult;
});

describe("Player V2 API Endpoints", () => {
    const testPlayers = [
        PlayerFactory.getPlayerObject("Akosua", PlayerLeagueType.MINOR),
        PlayerFactory.getPlayerObject("Aaron Judge", PlayerLeagueType.MAJOR),
        PlayerFactory.getPlayerObject("Jacob Kazama", PlayerLeagueType.MINOR),
    ];
    let savedPlayers: PlayerModel[];

    beforeEach(async () => {
        // TODO: Use prisma factory once we've switched over that dao function
        savedPlayers = await playerDao.createPlayers(testPlayers);
    });
    afterEach(async () => {
        return await clearPrismaDb(prismaConn);
    });

    describe("GET /v2/players{?where[]} (get all players)", () => {
        const getAllRequest = (param = "", status = 200) => makeGetRequest(request(app), `/v2/players${param}`, status);

        it("should return an array of all the users in the db", async () => {
            const { body } = await getAllRequest();
            expect(body).toBeArrayOfSize(testPlayers.length);
            expect(body.map((p: Player) => p.id)).toSatisfyAll(id => testPlayers.map(tp => tp.id).includes(id));
        });
        it("should return an array of all players filtered by a given field", async () => {
            const { body: filterByNameBody } = await getAllRequest("?where[]=name." + testPlayers[0].name);
            const { body: filterByLeagueBody } = await getAllRequest("?where[]=league.minors");
            const { body: filterByNoneBody } = await getAllRequest("?where[]=");

            expect(filterByNameBody).toBeArrayOfSize(1);
            expect(filterByNameBody[0].id).toEqual(savedPlayers[0].id);

            expect(filterByLeagueBody).toBeArrayOfSize(2);
            expect(filterByLeagueBody.map((p: Player) => p.id)).toSatisfyAll(id =>
                [savedPlayers[0].id, savedPlayers[2].id].includes(id)
            );

            expect(filterByNoneBody).toBeArrayOfSize(3);
            expect(filterByNoneBody.map((p: Player) => p.id)).toSatisfyAll(id =>
                savedPlayers.map(tp => tp.id).includes(id)
            );
        });
        it("should combine where parameters using AND logic", async () => {
            const { body: validFilterBody } = await getAllRequest("?where[]=name.Akosua&where[]=league.minors");
            const { body: missingFilterBody } = await getAllRequest("?where[]=name.Akosua&where[]=league.majors");

            expect(validFilterBody).toBeArrayOfSize(1);
            expect(validFilterBody[0].id).toEqual(savedPlayers[0].id);

            expect(missingFilterBody).toBeArrayOfSize(0);
        });
    });
});
