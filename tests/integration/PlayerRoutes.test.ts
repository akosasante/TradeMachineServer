import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import { WriteMode } from "../../src/csv/CsvUtils";
import TeamDAO from "../../src/DAO/TeamDAO";
import UserDAO from "../../src/DAO/UserDAO";
import Player, { PlayerLeagueType } from "../../src/models/player";
import Team from "../../src/models/team";
import User, { Role } from "../../src/models/user";
import { PlayerFactory } from "../factories/PlayerFactory";
import { TeamFactory } from "../factories/TeamFactory";
import { UserFactory } from "../factories/UserFactory";
import {
    adminLoggedIn, DatePatternRegex, doLogout, makeDeleteRequest, makeGetRequest, makePostRequest,
    makePutRequest, ownerLoggedIn, setupOwnerAndAdminUsers, stringifyQuery
} from "./helpers";
import { v4 as uuid } from "uuid";
import startServer from "../../src/bootstrap/app";

let app: Server;
let adminUser: User;
let ownerUser: User;
let team1: Team;
let team2: Team;
let team3: Team;
let user3: User;
let user4: User;

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
    logger.debug("~~~~~~PLAYER ROUTES BEFORE ALL~~~~~~");
    app = await startServer();

    const userDAO = new UserDAO();
    const teamDAO = new TeamDAO();
    // Create admin and owner users in db for rest of this suite's use
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
    await userDAO.updateUser(adminUser.id!, {csvName: "Cam"});
    await userDAO.updateUser(ownerUser.id!, {csvName: "Squad"});
    // Create users and teams for batch upload tests
    [user3, user4] = await userDAO.createUsers([
        UserFactory.getUserObject("akos@example.com", undefined,
        undefined, Role.OWNER, {name: "A", csvName: "Akos"}),
        UserFactory.getUserObject("kwasi@example.com", undefined, undefined, Role.OWNER,  {name: "K", csvName: "Kwasi"}),
    ]);
    [team1, team2, team3] = await teamDAO.createTeams([
        TeamFactory.getTeamObject( "Camtastic", 1),
        TeamFactory.getTeamObject( "Squad", 2),
        TeamFactory.getTeamObject( "Asantes", 3),
    ]);

    await teamDAO.updateTeamOwners(team1.id!, [adminUser], []);
    await teamDAO.updateTeamOwners(team2.id!, [ownerUser], []);
    await teamDAO.updateTeamOwners(team3.id!, [user3, user4], []);
});
afterAll(async () => {
    logger.debug("~~~~~~PLAYER ROUTES AFTER ALL~~~~~~");
    await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
});

describe("Player API endpoints", () => {
    const testPlayer = PlayerFactory.getPlayer();
    const testPlayer2 = PlayerFactory.getPlayer("Aaron Judge", PlayerLeagueType.MAJOR, {mlbTeam: "Boston Red Sox"});

    describe("POST /players (create new player)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (playerObjs: Partial<Player>[], status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Player>[]>(agent, "/players", playerObjs, status);
        const getOneRequest = (id: string, status: number = 200) =>
            makeGetRequest(request(app), `/players/${id}`, status);

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single player object based on object passed in", async () => {
            const {body} = await adminLoggedIn(postRequest([testPlayer.parse()]), app);
            const expected = {...testPlayer,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };
            expect(body[0]).toMatchObject(expected);
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const invalidPropsObj = {...testPlayer2.parse(), blah: "Hello"};
            const {body} = await adminLoggedIn(postRequest([invalidPropsObj]), app);
            const {body: getBody} =  await getOneRequest(body[0].id);
            const expected = {...testPlayer2,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };
            expect(getBody).toMatchObject(expected);
            expect(getBody.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const playerObj = { mlbTeam: "Boston Red Sox" };
            const res = await adminLoggedIn(postRequest([playerObj], 400), app);
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        // it("should return a 403 Forbidden error if a non-admin tries to create a player", async () => {
        //     await ownerLoggedIn(postRequest([testPlayer.parse()], 403), app);
        // });
        // it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
        //     await postRequest([testPlayer.parse()], 403)(request(app));
        // });
    });

    describe("GET /players[?include=playerLeagueLevel] (get all players)", () => {
        const getAllRequest = (param: string = "", status: number = 200) =>
            makeGetRequest(request(app), `/players${param}`, status);

        it("should return an array of all players in the db", async () => {
            const {body} = await getAllRequest();
            const expected = {...testPlayer,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };
            const returnedPlayer = body.find((player: Player) => player.id === testPlayer.id);

            expect(body).toBeArrayOfSize(2);
            expect(returnedPlayer).toMatchObject(expected);
        });
        it("should return an array of all players in a given league or leagues", async () => {
            const {body: minorPlayers} = await getAllRequest("?include[]=minors");
            const {body: majorPlayers} = await getAllRequest("?include[]=majors");

            expect(minorPlayers).toBeArrayOfSize(1);
            expect(majorPlayers).toBeArrayOfSize(1);

            expect(majorPlayers.find((player: Player) => player.id === testPlayer2.id)).toBeDefined();
            expect(majorPlayers.find((player: Player) => player.id === testPlayer.id)).toBeUndefined();

            expect(minorPlayers.find((player: Player) => player.id === testPlayer.id)).toBeDefined();
            expect(minorPlayers.find((player: Player) => player.id === testPlayer2.id)).toBeUndefined();
        });
    });

    describe("GET /players/:id (get one player)", () => {
        const getOneRequest = (id: string, status: number = 200) =>
            makeGetRequest(request(app), `/players/${id}`, status);

        it("should return a single player for the given id", async () => {
            const {body} = await getOneRequest(testPlayer.id!);
            const expected = {...testPlayer,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };
            expect(body).toBeObject();
            expect(body).toMatchObject(expected);
        });
        it("should throw a 404 Not Found error if there is no player with that ID", async () => {
            await getOneRequest(uuid(), 404);
        });
    });

    describe("GET /players/search?queryOpts (get players by query)", () => {
        const findRequest = (query: Partial<Player>, status: number = 200) =>
            makeGetRequest(request(app), `/players/search${stringifyQuery(query as { [key: string]: string; })}`, status);

        it("should return players for the given query", async () => {
            const {body} = await findRequest({mlbTeam: "Boston Red Sox"});
            const expected = {...testPlayer2,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };
            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject(expected);
        });
        it("should throw a 404 error if no player with that query is found", async () => {
            await findRequest({ mlbTeam: "Toronto Blue Jays" }, 404);
        });
    });

    describe("PUT /players/:id (update one player)", () => {
        const putRequest = (id: string, playerObj: Partial<Player>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<Player>>(agent, `/players/${id}`, playerObj, status);
        const updatedPlayerObj = {mlbTeam: "Miami Marlins"};
        const updatedPlayer = new Player({...testPlayer, ...updatedPlayerObj});
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated player", async () => {
            const {body} = await adminLoggedIn(putRequest(updatedPlayer.id!, updatedPlayerObj), app);
            expect(body).toMatchObject(updatedPlayer);
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const invalidObj = {...updatedPlayerObj, blah: "wassup"};
            await adminLoggedIn(putRequest(testPlayer.id!, invalidObj, 400), app);

            // Confirm db was not updated:
            const {body: getOneBody} = await request(app).get(`/players/${testPlayer.id}`).expect(200);
            expect(getOneBody).toMatchObject(updatedPlayer);
            expect(getOneBody.blah).toBeUndefined();
        });
        it("should throw a 404 Not Found error if there is no player with that ID", async () => {
            await adminLoggedIn(putRequest(uuid(), updatedPlayerObj, 404), app);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to update a player", async () => {
            await ownerLoggedIn(putRequest(uuid(), updatedPlayerObj, 403), app);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await putRequest(uuid(), updatedPlayerObj, 403)(request(app));
        });
    });

    describe("DELETE /players/:id (delete one player)", () => {
        const deleteRequest = (id: string, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/players/${id}`, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const {body} = await adminLoggedIn(deleteRequest(testPlayer.id!), app);
            expect(body).toEqual({deleteCount: 1, id: testPlayer.id});

            // Confirm that it was deleted from the db:
            const {body: getAllRes} = await request(app).get("/players").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
        it("should throw a 404 Not Found error if there is no player with that ID", async () => {
            await adminLoggedIn(deleteRequest(testPlayer.id!, 404), app);
            const {body: getAllRes} = await request(app).get("/players").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to delete a player", async () => {
            await ownerLoggedIn(deleteRequest(testPlayer.id!, 403), app);
            const {body: getAllRes} = await request(app).get("/players").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await deleteRequest(testPlayer.id!, 403)(request(app));
            const {body: getAllRes} = await request(app).get("/players").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
    });

    describe("POST /batch (batch add new minor league players via csv file)", () => {
        const csv = `${process.env.BASE_DIR}/tests/resources/three-teams-four-owners-minor-players.csv`;
        const postFileRequest = (filePath: string, mode?: WriteMode, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                agent
                    .post(`/players/batch${mode ? "?mode=" + mode : ""}`)
                    .attach("minors", filePath)
                    .expect("Content-Type", /json/)
                    .expect(status);
        const requestWithoutFile = (mode?: WriteMode, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                agent
                    .post(`/players/batch${mode ? "?mode=" + mode : ""}`)
                    .expect("Content-Type", /json/)
                    .expect(status);

        it("should append by default", async () => {
            const {body: getAllRes} = await request(app).get("/players").expect(200);
            expect(getAllRes).toBeArrayOfSize(1); // This one is a major league player so it'll never get deleted

            const {body: batchPutRes} = await adminLoggedIn(postFileRequest(csv), app);
            expect(batchPutRes).toBeArrayOfSize(99);
            const {body: afterGetAllRes} = await request(app).get("/players").expect(200);
            expect(afterGetAllRes).toBeArrayOfSize(100);
        });
        it("should append with the given mode passed in", async () => {
            const {body: getAllRes} = await request(app).get("/players").expect(200);
            expect(getAllRes).toBeArrayOfSize(100);

            const {body: batchPutRes} = await adminLoggedIn(postFileRequest(csv, "append"), app);
            expect(batchPutRes).toBeArrayOfSize(99);
            const {body: afterGetAllRes} = await request(app).get("/players").expect(200);
            expect(afterGetAllRes).toBeArrayOfSize(199);
        });
        it("should overwrite with the given mode passed in", async () => {
            const {body: getAllRes} = await request(app).get("/players").expect(200);
            expect(getAllRes).toBeArrayOfSize(199);

            const {body: batchPutRes} = await adminLoggedIn(postFileRequest(csv, "overwrite"), app);
            expect(batchPutRes).toBeArrayOfSize(99);
            const {body: afterGetAllRes} = await request(app).get("/players").expect(200);
            expect(afterGetAllRes).toBeArrayOfSize(100);
        });
        it("should return a 400 Bad Request if no file is passed in", async () => {
            await (adminLoggedIn(requestWithoutFile("overwrite", 400), app));
        });
        it("should return a 403 Forbidden error if a non-admin tries to upload new players", async () => {
            await ownerLoggedIn(postFileRequest(csv, "overwrite", 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged-in request is used", async () => {
            await postFileRequest(csv, "overwrite", 403)(request(app));
        });
    });
});
