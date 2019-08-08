import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import { WriteMode } from "../../src/csv/CsvUtils";
import TeamDAO from "../../src/DAO/TeamDAO";
import UserDAO from "../../src/DAO/UserDAO";
import Player, { LeagueLevel } from "../../src/models/player";
import Team from "../../src/models/team";
import User, { Role } from "../../src/models/user";
import server from "../../src/server";
import {
    doLogout,
    makeDeleteRequest,
    makeGetRequest,
    makeLoggedInRequest,
    makePostRequest,
    makePutRequest,
    stringifyQuery
} from "./helpers";

let app: Server;
let adminUser: User;
let ownerUser: User;
let team1: Team;
let team2: Team;
let team3: Team;
const adminUserObj = { email: "admin@example.com", password: "lol", name: "Cam", shortName: "Cam", roles: [Role.ADMIN]};
const ownerUserObj = { email: "owner@example.com", password: "lol", name: "J", shortName: "Squad", roles: [Role.OWNER]};
const userObj3 = { email: "akos@example.com", password: "lol", name: "A", roles: [Role.OWNER], shortName: "Akos"};
const userObj4 = { email: "kwasi@example.com", password: "lol", name: "K", roles: [Role.OWNER], shortName: "Kwasi"};

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

    const userDAO = new UserDAO();
    const teamDAO = new TeamDAO();
    // Create admin and owner users in db for rest of this suite's use
    adminUser = await userDAO.createUser({...adminUserObj});
    ownerUser = await userDAO.createUser({...ownerUserObj});
    // Create users and teams for batch upload tests
    const user3 = await userDAO.createUser({...userObj3});
    const user4 = await userDAO.createUser({...userObj4});
    team1 = await teamDAO.createTeam({name: "Camtastic", owners: [adminUser]});
    team2 = await teamDAO.createTeam({name: "Squad", owners: [ownerUser]});
    team3 = await teamDAO.createTeam({name: "Asantes", owners: [user3, user4]});
});
afterAll(async () => {
    await shutdown();
});

describe("Player API endpoints", () => {
    const testPlayerObj = { name: "Honus Wiener", league: LeagueLevel.HIGH };
    const testPlayerObj2 = { name: "Aaron Judge", league: LeagueLevel.MAJOR, mlbTeam: "Boston Red Sox" };
    const testPlayer = new Player(testPlayerObj);
    const adminLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), adminUserObj.email, adminUserObj.password, requestFn);
    const ownerLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), ownerUserObj.email, ownerUserObj.password, requestFn);

    describe("POST /players (create new player)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (playerObj: Partial<Player>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Player>>(agent, "/players", playerObj, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single player object based on object passed in", async () => {
            const res = await adminLoggedIn(postRequest(testPlayerObj));
            expect(testPlayer.equals(res.body)).toBeTrue();
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            jest.setTimeout(30000);
            const playerObj = {...testPlayerObj2, blah: "Hello"};
            const testInvalidProps = new Player(playerObj);
            const res = await adminLoggedIn(postRequest(testInvalidProps));
            expect(testInvalidProps.equals(res.body)).toBeTrue();
            expect(res.body.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const playerObj = { mlbTeam: "Boston Red Sox" };
            const res = await adminLoggedIn(postRequest(playerObj, 400));
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a player", async () => {
            await ownerLoggedIn(postRequest(testPlayerObj, 403));
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest(testPlayerObj, 403)(request(app));
        });
    });

    describe("GET /players[?include=playerLeagueLevel] (get all players)", () => {
        const getAllRequest = (param: string = "", status: number = 200) =>
            makeGetRequest(request(app), `/players${param}`, status);

        it("should return an array of all players in the db", async () => {
            const res = await getAllRequest();
            expect(res.body).toBeArrayOfSize(2);
            expect(testPlayer.equals(res.body[0])).toBeTrue();
        });
        it("should return an array of all players in a given league or leagues", async () => {
            const res1 = await getAllRequest("?include[]=high");
            const res2 = await getAllRequest("?include[]=high&include[]=majors");

            expect(res1.body).toBeArrayOfSize(1);
            expect(res2.body).toBeArrayOfSize(2);
            expect(testPlayer.equals(res2.body[0])).toBeTrue();
        });
        it("should throw a 404 error if no players in a given league found", async () => {
            await getAllRequest("?include[]=low", 404);
        });
    });

    describe("GET /players/:id (get one player)", () => {
        const getOneRequest = (id: number, status: number = 200) =>
            makeGetRequest(request(app), `/players/${id}`, status);

        it("should return a single player for the given id", async () => {
            const res = await getOneRequest(1);
            expect(res.body).toBeObject();
            expect(testPlayer.equals(res.body)).toBeTrue();
            expect(res.body.id).toEqual(1);
        });
        it("should throw a 404 Not Found error if there is no player with that ID", async () => {
            await getOneRequest(999, 404);
        });
    });

    describe("GET /players/search?queryOpts (get players by query)", () => {
        const findRequest = (query: Partial<Player>, status: number = 200) =>
            makeGetRequest(request(app), `/players/search${stringifyQuery(query)}`, status);

        it("should return players for the given query", async () => {
            const res = await findRequest({mlbTeam: "Boston Red Sox"});
            const testPlayer2 = new Player(testPlayerObj2);

            expect(res.body).toBeArrayOfSize(1);
            expect(testPlayer2.equals(res.body[0])).toBeTrue();
            expect(res.body[0].id).toEqual(2);
        });
        it("should throw a 404 error if no player with that query is found", async () => {
            await findRequest({ mlbTeam: "Toronto Blue Jays" }, 404);
        });
    });

    describe("PUT /players/:id (update one player)", () => {
        const putRequest = (id: number, playerObj: Partial<Player>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<Player>>(agent, `/players/${id}`, playerObj, status);
        const updatedPlayerObj = {...testPlayerObj, mlbTeam: "Miami Marlins", id: 1};
        const updatedPlayer = new Player(updatedPlayerObj);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated player", async () => {
            const res = await adminLoggedIn(putRequest(updatedPlayerObj.id, updatedPlayerObj));
            expect(updatedPlayer.equals(res.body)).toBeTrue();

            // Confirm db was actually updated:
            const getOnePlayer = await request(app).get(`/players/${updatedPlayerObj.id}`).expect(200);
            expect(updatedPlayer.equals(getOnePlayer.body)).toBeTrue();
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const invalidObj = {...updatedPlayerObj, id: 1, blah: "wassup"};
            await adminLoggedIn(putRequest(invalidObj.id, invalidObj, 400));

            // Confirm db was not updated:
            const existingPlayer = await request(app).get(`/players/${invalidObj.id}`).expect(200);
            expect(updatedPlayer.equals(existingPlayer.body)).toBeTrue();
            expect(existingPlayer.body.blah).toBeUndefined();
        });
        it("should throw a 404 Not Found error if there is no player with that ID", async () => {
            await adminLoggedIn(putRequest(999, updatedPlayerObj, 404));
        });
        it("should throw a 403 Forbidden error if a non-admin tries to update a player", async () => {
            await ownerLoggedIn(putRequest(updatedPlayerObj.id, updatedPlayerObj, 403));
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await putRequest(updatedPlayerObj.id, updatedPlayerObj, 403)(request(app));
        });
    });

    describe("DELETE /players/:id (delete one player)", () => {
        const deleteRequest = (id: number, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/players/${id}`, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const res = await adminLoggedIn(deleteRequest(1));
            expect(res.body).toEqual({deleteResult: true, id: 1});

            // Confirm that it was deleted from the db:
            const getAllRes = await request(app).get("/players").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1);
        });
        it("should throw a 404 Not Found error if there is no player with that ID", async () => {
            await adminLoggedIn(deleteRequest(1, 404));
            const getAllRes = await request(app).get("/players").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to delete a player", async () => {
            await ownerLoggedIn(deleteRequest(2, 403));
            const getAllRes = await request(app).get("/players").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await deleteRequest(2, 403)(request(app));
            const getAllRes = await request(app).get("/players").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1);
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
            const getAllRes = await request(app).get("/players").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1); // This one is a major league player so it'll neverr get deleted

            const batchPutRes = await adminLoggedIn(postFileRequest(csv));
            expect(batchPutRes.body).toBeArrayOfSize(99);
            const afterGetAllRes = await request(app).get("/players").expect(200);
            expect(afterGetAllRes.body).toBeArrayOfSize(100);
        });
        it("should append with the given mode passed in", async () => {
            const getAllRes = await request(app).get("/players").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(100);

            const batchPutRes = await adminLoggedIn(postFileRequest(csv, "append"));
            expect(batchPutRes.body).toBeArrayOfSize(99);
            const afterGetAllRes = await request(app).get("/players").expect(200);
            expect(afterGetAllRes.body).toBeArrayOfSize(199);
        });
        it("should overwrite with the given mode passed in", async () => {
            const getAllRes = await request(app).get("/players").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(199);

            const batchPutRes = await adminLoggedIn(postFileRequest(csv, "overwrite"));
            expect(batchPutRes.body).toBeArrayOfSize(99);
            const afterGetAllRes = await request(app).get("/players").expect(200);
            expect(afterGetAllRes.body).toBeArrayOfSize(100);
        });
        it("should return a 400 Bad Request if no file is passed in", async () => {
            await (adminLoggedIn(requestWithoutFile("overwrite", 400)));
        });
        it("should return a 403 Forbidden error if a non-admin tries to upload new players", async () => {
            await ownerLoggedIn(postFileRequest(csv, "overwrite", 403));
        });
        it("should return a 403 Forbidden error if a non-logged-in request is used", async () => {
            await postFileRequest(csv, "overwrite", 403)(request(app));
        });
    });

});
