import { Server } from "http";
import "jest-extended";
import request from "supertest";
import logger from "../../src/bootstrap/logger";
import { WriteMode } from "../../src/csv/CsvUtils";
import TeamDAO from "../../src/DAO/TeamDAO";
import UserDAO from "../../src/DAO/UserDAO";
import Player, { PlayerLeagueType } from "../../src/models/player";
import User, { Role } from "../../src/models/user";
import { PlayerFactory } from "../factories/PlayerFactory";
import { TeamFactory } from "../factories/TeamFactory";
import { UserFactory } from "../factories/UserFactory";
import {
    adminLoggedIn,
    clearPrismaDb,
    DatePatternRegex,
    doLogout,
    makeDeleteRequest,
    makeGetRequest,
    makePostRequest,
    makePutRequest,
    ownerLoggedIn,
    setupOwnerAndAdminUsers,
    stringifyQuery,
} from "./helpers";
import { v4 as uuid } from "uuid";
import startServer from "../../src/bootstrap/app";
import PlayerDAO from "../../src/DAO/PlayerDAO";
import initializeDb, { ExtendedPrismaClient } from "../../src/bootstrap/prisma-db";
import { handleExitInTest } from "../../src/bootstrap/shutdownHandler";

let app: Server;
let adminUser: User;
let ownerUser: User;
let userDAO: UserDAO;
let teamDAO: TeamDAO;
let playerDAO: PlayerDAO;
let prismaConn: ExtendedPrismaClient;
async function shutdown() {
    try {
        await handleExitInTest();
    } catch (err) {
        logger.error(`Error while shutting down: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~PLAYER ROUTES BEFORE ALL~~~~~~");
    process.env.SKIP_CACHE_IN_TEST = "true";
    app = await startServer();
    prismaConn = initializeDb(process.env.DB_LOGS === "true");
    userDAO = new UserDAO();
    teamDAO = new TeamDAO();
    playerDAO = new PlayerDAO();

    return app;
}, 5000);

afterAll(async () => {
    logger.debug("~~~~~~PLAYER ROUTES AFTER ALL~~~~~~");
    process.env.SKIP_CACHE_IN_TEST = "false";
    const shutdownResult = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownResult;
});

describe("Player API endpoints", () => {
    beforeEach(async () => {
        // Create admin and owner users in db for rest of this suite's use
        [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
        return ownerUser;
    });

    afterEach(async () => {
        return await clearPrismaDb(prismaConn);
    });

    describe("POST /players (create new player)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest =
            (playerObjs: Partial<Player>[], status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Player>[]>(agent, "/players", playerObjs, status);
        const getOneRequest = (id: string, status = 200) => makeGetRequest(request(app), `/players/${id}`, status);

        it("should return a list of player objects based on object(s) passed in", async () => {
            const testPlayer1 = PlayerFactory.getPlayer();

            const { body } = await adminLoggedIn(postRequest([testPlayer1.parse()]), app);

            expect(body[0]).toMatchObject({
                ...testPlayer1,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            });
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const testPlayer1 = PlayerFactory.getPlayer();
            const invalidPropsObj = { ...testPlayer1.parse(), blah: "Hello" };

            const { body } = await adminLoggedIn(postRequest([invalidPropsObj]), app);

            const { body: getBody } = await getOneRequest(body[0].id);

            expect(getBody).toMatchObject({
                ...testPlayer1,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            });
            expect(getBody.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const playerObj = { mlbTeam: "Boston Red Sox" };
            const res = await adminLoggedIn(postRequest([playerObj], 400), app);
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        // eslint-disable-next-line jest/no-commented-out-tests
        // it("should return a 403 Forbidden error if a non-admin tries to create a player", async () => {
        //     await ownerLoggedIn(postRequest([testPlayer.parse()], 403), app);
        // });
        // eslint-disable-next-line jest/no-commented-out-tests
        // it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
        //     await postRequest([testPlayer.parse()], 403)(request(app));
        // });
    });

    describe("GET /players[?include=playerLeagueLevel] (get all players)", () => {
        const getAllRequest = (param = "", status = 200) => makeGetRequest(request(app), `/players${param}`, status);

        it("should return an array of all players in the db", async () => {
            const testPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
            ];
            await playerDAO.createPlayers(testPlayers.map(p => p.parse()));

            const { body } = await getAllRequest();

            expect(body).toBeArrayOfSize(2);

            expect(body.map((p: Player) => p.id)).toSatisfyAll(id => testPlayers.map(tp => tp.id).includes(id));
        });
        it("should return an array of all players in a given league or leagues", async () => {
            const testPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
                PlayerFactory.getPlayer("Bo Bichette", PlayerLeagueType.MAJOR),
            ];
            await playerDAO.createPlayers(testPlayers.map(p => p.parse()));

            const { body: minorPlayers } = await getAllRequest("?include[]=minors");
            const { body: majorPlayers } = await getAllRequest("?include[]=majors");
            const { body: allPlayers } = await getAllRequest("?include[]=majors&include[]=minors");

            expect(minorPlayers).toBeArrayOfSize(1);
            expect(majorPlayers).toBeArrayOfSize(2);
            expect(allPlayers).toBeArrayOfSize(3);
            expect(minorPlayers[0].id).toEqual(testPlayers[0].id);
            expect(allPlayers[0].id).toEqual(testPlayers[0].id);
            expect(majorPlayers[0].id).toEqual(testPlayers[1].id);
        });
    });

    describe("GET /players/:id (get one player)", () => {
        const getOneRequest = (id: string, status = 200) => makeGetRequest(request(app), `/players/${id}`, status);

        it("should return a single player for the given id", async () => {
            const testPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
            ];
            await playerDAO.createPlayers(testPlayers.map(p => p.parse()));

            const { body } = await getOneRequest(testPlayers[0].id!);

            expect(body).toBeObject();
            expect(body).toMatchObject(testPlayers[0]);
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 404 Not Found error if there is no player with that ID", async () => {
            await getOneRequest(uuid(), 404);
        });
    });

    describe("GET /players/search?queryOpts (get players by query)", () => {
        const findRequest = (query: Partial<Player> & { leagueTeamId?: string }, status = 200) =>
            makeGetRequest(
                request(app),
                `/players/search${stringifyQuery(query as { [key: string]: string })}`,
                status
            );

        it("should return players for the given query", async () => {
            const testPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
            ];
            await playerDAO.createPlayers(testPlayers.map(p => p.parse()));

            const { body } = await findRequest({ mlbTeam: "Boston Red Sox" });

            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject(testPlayers[1]);
        });
        it("should handle multiple query parameters", async () => {
            const [team1, team2] = await teamDAO.createTeams([
                TeamFactory.getTeamObject("Camtastic", 11),
                TeamFactory.getTeamObject("Squad", 12),
            ]);
            const testPlayers = [
                PlayerFactory.getPlayer("Brett Lawrie", PlayerLeagueType.MINOR, { leagueTeam: team1 }),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MINOR, { leagueTeam: team2 }),
                PlayerFactory.getPlayer("Yu Darvish", PlayerLeagueType.MAJOR, { leagueTeam: team2 }),
            ];
            await playerDAO.createPlayers(testPlayers.map(p => p.parse()));

            const { body } = await findRequest({ leagueTeamId: team2.id, league: 2 });

            const expectedPlayer = testPlayers[1].parse<Player>();
            delete expectedPlayer.leagueTeam;
            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject(expectedPlayer);
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 404 error if no player with that query is found", async () => {
            await findRequest({ mlbTeam: "Toronto Blue Jays" }, 404);
        });
    });

    describe("GET /players/search_by_name?name (search for players by name)", () => {
        const findRequest = (name: string, status = 200) =>
            makeGetRequest(request(app), `/players/search_by_name?name=${name}`, status);
        const findRequestWithLeagueId = (name: string, league: number, status = 200) =>
            makeGetRequest(request(app), `/players/search_by_name?name=${name}&league=${league}`, status);

        it("should return players whose names match the given query", async () => {
            const testPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Fudge"),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
            ];
            await playerDAO.createPlayers(testPlayers.map(p => p.parse()));

            const { body } = await findRequest("ron");

            expect(body).toBeArrayOfSize(2);
            expect(body[0]).toMatchObject(testPlayers[1]);
            expect(body[1]).toMatchObject(testPlayers[2]);
        });

        it("should allow passing in a leagueId to further filter the results", async () => {
            const testPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Fudge"),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
            ];
            await playerDAO.createPlayers(testPlayers.map(p => p.parse()));

            const { body } = await findRequestWithLeagueId("ron", 1);

            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject(testPlayers[2]);
        });
    });

    describe("PUT /players/:id (update one player)", () => {
        const putRequest =
            (id: string, playerObj: Partial<Player>, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<Player>>(agent, `/players/${id}`, playerObj, status);
        const updatedPlayerObj = { mlbTeam: "Miami Marlins" };

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return the updated player", async () => {
            const testPlayer1 = PlayerFactory.getPlayer();
            await playerDAO.createPlayers([testPlayer1.parse()]);

            const { body } = await adminLoggedIn(putRequest(testPlayer1.id!, updatedPlayerObj), app);

            expect(body).toMatchObject(new Player({ ...testPlayer1, ...updatedPlayerObj }));
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const testPlayer1 = PlayerFactory.getPlayer();
            await playerDAO.createPlayers([testPlayer1.parse()]);
            const invalidObj = { ...updatedPlayerObj, blah: "wassup" };

            await adminLoggedIn(putRequest(testPlayer1.id!, invalidObj, 400), app);

            // Confirm db was not updated:
            const { body: getOneBody } = await request(app).get(`/players/${testPlayer1.id}`).expect(200);
            expect(getOneBody).toMatchObject(testPlayer1);
            expect(getOneBody.blah).toBeUndefined();
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 404 Not Found error if there is no player with that ID", async () => {
            await adminLoggedIn(putRequest(uuid(), updatedPlayerObj, 404), app);
        }, 2000);
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 403 Forbidden error if a non-admin tries to update a player", async () => {
            await ownerLoggedIn(putRequest(uuid(), updatedPlayerObj, 403), app);
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await putRequest(uuid(), updatedPlayerObj, 403)(request(app));
        });
    });

    describe("DELETE /players/:id (delete one player)", () => {
        const deleteRequest =
            (id: string, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makeDeleteRequest(agent, `/players/${id}`, status);
        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const testPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
            ];
            await playerDAO.createPlayers(testPlayers.map(p => p.parse()));

            const { body } = await adminLoggedIn(deleteRequest(testPlayers[0].id!), app);
            expect(body).toEqual({ deleteCount: 1, id: testPlayers[0].id });

            // Confirm that it was deleted from the db:
            const { body: getAllRes } = await request(app).get("/players").expect(200);

            expect(getAllRes).toBeArrayOfSize(1);
            expect(getAllRes[0].id).toEqual(testPlayers[1].id);
        });
        it("should throw a 404 Not Found error if there is no player with that ID", async () => {
            const testPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
            ];
            await playerDAO.createPlayers(testPlayers.map(p => p.parse()));

            await adminLoggedIn(deleteRequest(uuid(), 404), app);
            const { body: getAllRes } = await request(app).get("/players").expect(200);

            expect(getAllRes).toBeArrayOfSize(2);
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 403 Forbidden error if a non-admin tries to delete a player", async () => {
            await ownerLoggedIn(deleteRequest(uuid(), 403), app);
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await deleteRequest(uuid(), 403)(request(app));
        });
    });

    describe("POST /batch (batch add new minor league players via csv file)", () => {
        // CSV contains 99 minor league players
        const csv = `${process.env.BASE_DIR}/tests/resources/three-teams-four-owners-minor-players.csv`;
        const postFileRequest =
            (filePath: string, mode?: WriteMode, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                agent
                    .post(`/players/batch${mode ? "?mode=" + mode : ""}`)
                    .attach("minors", filePath)
                    .expect("Content-Type", /json/)
                    .expect(status);
        const requestWithoutFile =
            (mode?: WriteMode, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                agent
                    .post(`/players/batch${mode ? "?mode=" + mode : ""}`)
                    .expect("Content-Type", /json/)
                    .expect(status);

        beforeEach(async () => {
            // Updating + adding users for each of the owners in the test CSV file
            await userDAO.updateUser(adminUser.id!, { csvName: "Cam" });
            await userDAO.updateUser(ownerUser.id!, { csvName: "Squad" });
            const [akos, kwasi] = await userDAO.createUsers([
                UserFactory.getUserObject("akos@example.com", undefined, undefined, Role.OWNER, {
                    name: "A",
                    csvName: "Akos",
                }),
                UserFactory.getUserObject("kwasi@example.com", undefined, undefined, Role.OWNER, {
                    name: "K",
                    csvName: "Kwasi",
                }),
            ]);
            const [team1, team2, team3] = await teamDAO.createTeams([
                TeamFactory.getTeamObject("Camtastic", 1),
                TeamFactory.getTeamObject("Squad", 2),
                TeamFactory.getTeamObject("Asantes", 3),
            ]);

            await teamDAO.updateTeamOwners(team1.id!, [adminUser], []);
            await teamDAO.updateTeamOwners(team2.id!, [ownerUser], []);
            return await teamDAO.updateTeamOwners(team3.id!, [akos, kwasi], []);
        });

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should append by default", async () => {
            const initialPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
            ];
            await playerDAO.createPlayers(initialPlayers.map(p => p.parse()));

            const { body: getAllRes } = await request(app).get("/players").expect(200);
            expect(getAllRes).toBeArrayOfSize(2);

            const { body: batchPutRes } = await adminLoggedIn(postFileRequest(csv), app);
            expect(batchPutRes).toBeArrayOfSize(99);

            const { body: afterGetAllRes } = await request(app).get("/players").expect(200);
            expect(afterGetAllRes).toBeArrayOfSize(101);

            const { body: afterGetAllResMinorsOnly } = await request(app).get("/players?include[]=minors").expect(200);
            expect(afterGetAllResMinorsOnly).toBeArrayOfSize(100);
        }, 5000);
        it("should append with the given mode passed in", async () => {
            const initialPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
            ];
            await playerDAO.createPlayers(initialPlayers.map(p => p.parse()));

            const { body: getAllRes } = await request(app).get("/players").expect(200);
            expect(getAllRes).toBeArrayOfSize(2);

            const { body: batchPutRes } = await adminLoggedIn(postFileRequest(csv, "append"), app);
            expect(batchPutRes).toBeArrayOfSize(99);

            const { body: afterGetAllRes } = await request(app).get("/players").expect(200);
            expect(afterGetAllRes).toBeArrayOfSize(101);

            const { body: afterGetAllResMinorsOnly } = await request(app).get("/players?include[]=minors").expect(200);
            expect(afterGetAllResMinorsOnly).toBeArrayOfSize(100);
        });
        it("should overwrite with the given mode passed in", async () => {
            const initialPlayers = [
                PlayerFactory.getPlayer(),
                PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, { mlbTeam: "Boston Red Sox" }),
            ];
            await playerDAO.createPlayers(initialPlayers.map(p => p.parse()));

            const { body: getAllRes } = await request(app).get("/players").expect(200);
            expect(getAllRes).toBeArrayOfSize(2);

            const { body: batchPutRes } = await adminLoggedIn(postFileRequest(csv, "overwrite"), app);
            expect(batchPutRes).toBeArrayOfSize(99);

            const { body: afterGetAllRes } = await request(app).get("/players").expect(200);
            expect(afterGetAllRes).toBeArrayOfSize(100);

            const { body: afterGetAllResMinorsOnly } = await request(app).get("/players?include[]=minors").expect(200);
            expect(afterGetAllResMinorsOnly).toBeArrayOfSize(99);
            expect(afterGetAllRes.find((player: Player) => player.id === initialPlayers[0].id)).toBeUndefined();
        }, 10000);
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should return a 400 Bad Request if no file is passed in", async () => {
            await adminLoggedIn(requestWithoutFile("overwrite", 400), app);
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should return a 403 Forbidden error if a non-admin tries to upload new players", async () => {
            await ownerLoggedIn(postFileRequest(csv, "overwrite", 403), app);
        });
        // assertion happens inside api call helper function
        // eslint-disable-next-line jest/expect-expect
        it("should return a 403 Forbidden error if a non-logged-in request is used", async () => {
            await postFileRequest(csv, "overwrite", 403)(request(app));
        });
    });
});
