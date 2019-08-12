import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import { WriteMode } from "../../src/csv/CsvUtils";
import TeamDAO from "../../src/DAO/TeamDAO";
import UserDAO from "../../src/DAO/UserDAO";
import DraftPick from "../../src/models/draftPick";
import { LeagueLevel } from "../../src/models/player";
import Team from "../../src/models/team";
import User, { Role } from "../../src/models/user";
import server from "../../src/server";
import { DraftPickFactory } from "../factories/DraftPickFactory";
import { TeamFactory } from "../factories/TeamFactory";
import {
    adminLoggedIn,
    doLogout,
    makeDeleteRequest,
    makeGetRequest,
    makePostRequest,
    makePutRequest,
    ownerLoggedIn,
    setupOwnerAndAdminUsers,
    stringifyQuery
} from "./helpers";

let app: Server;
let adminUser: User;
let ownerUser: User;
let team1: Team;
let team2: Team;
let team3: Team;
let user3: User;

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
    logger.debug("~~~~~~DRAFT PICK ROUTES BEFORE ALL~~~~~~");
    app = await server;

    const userDAO = new UserDAO();
    const teamDAO = new TeamDAO();
    // Create admin and owner users in db for rest of this suite's use
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
    await userDAO.updateUser(adminUser.id!, {name: "Cam", shortName: "Cam"});
    await userDAO.updateUser(ownerUser.id!, {name: "A", shortName: "Akos"});
    // Create users and teams for batch upload tests
    user3 = await userDAO.createUser({ email: "kwasi@example.com", password: "lol", name: "K",
        roles: [Role.OWNER], shortName: "Kwasi"});
    team1 = await teamDAO.createTeam(TeamFactory.getTeamObject( "Camtastic", 1, {owners: [adminUser]}));
    team2 = await teamDAO.createTeam(TeamFactory.getTeamObject( "Squad", 2, {owners: [ownerUser]}));
    team3 = await teamDAO.createTeam(TeamFactory.getTeamObject( "Asantes", 3, {owners: [user3]}));
});
afterAll(async () => {
    logger.debug("~~~~~~DRAFT PICK ROUTES AFTER ALL~~~~~~");
    await shutdown();
    app.close(() => {
        logger.debug("CLOSED SERVER");
    });
});

describe("Pick API endpoints", () => {
    const testPickObj = DraftPickFactory.getPickObject(undefined, undefined, LeagueLevel.HIGH);
    const testPickObj2 =  DraftPickFactory.getPickObject(2, 6, LeagueLevel.MAJOR);
    const testPick = new DraftPick(testPickObj);

    describe("POST /picks (create new pick)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (pickObj: Partial<DraftPick>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<DraftPick>>(agent, "/picks", pickObj, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single pick object based on object passed in", async () => {
            const res = await adminLoggedIn(postRequest(testPickObj), app);
            expect(testPick.equals(res.body)).toBeTrue();
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const pickObj = {...testPickObj2, blah: "Hello"};
            const testInvalidProps = new DraftPick(pickObj);
            const res = await adminLoggedIn(postRequest(testInvalidProps), app);
            expect(testInvalidProps.equals(res.body)).toBeTrue();
            expect(res.body.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const pickObj = { season: 2017 };
            const res = await adminLoggedIn(postRequest(pickObj, 400), app);
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a pick", async () => {
            await ownerLoggedIn(postRequest(testPickObj, 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest(testPickObj, 403)(request(app));
        });
    });

    describe("GET /picks[?include=draftType] (get all picks)", () => {
        const getAllRequest = (param: string = "", status: number = 200) =>
            makeGetRequest(request(app), `/picks${param}`, status);

        it("should return an array of all picks in the db", async () => {
            const res = await getAllRequest();
            expect(res.body).toBeArrayOfSize(2);
            expect(testPick.equals(res.body[0])).toBeTrue();
        });
        it("should return an array of all picks in a given league or leagues", async () => {
            const res1 = await getAllRequest("?include[]=high");
            const res2 = await getAllRequest("?include[]=high&include[]=majors");

            expect(res1.body).toBeArrayOfSize(1);
            expect(res2.body).toBeArrayOfSize(2);
            expect(testPick.equals(res2.body[0])).toBeTrue();
        });
        it("should throw a 404 error if no picks in a given league found", async () => {
            await getAllRequest("?include[]=low", 404);
        });
    });

    describe("GET /picks/:id (get one pick)", () => {
        const getOneRequest = (id: number, status: number = 200) =>
            makeGetRequest(request(app), `/picks/${id}`, status);

        it("should return a single pick for the given id", async () => {
            const res = await getOneRequest(1);
            expect(res.body).toBeObject();
            expect(testPick.equals(res.body)).toBeTrue();
            expect(res.body.id).toEqual(1);
        });
        it("should throw a 404 Not Found error if there is no pick with that ID", async () => {
            await getOneRequest(999, 404);
        });
    });

    describe("GET /picks/search?queryOpts (get picks by query)", () => {
        const findRequest = (query: Partial<DraftPick>, status: number = 200) =>
            makeGetRequest(request(app), `/picks/search${stringifyQuery(query)}`, status);

        it("should return picks for the given query", async () => {
            const res = await findRequest({round: 2});
            const testPick2 = new DraftPick(testPickObj2);

            expect(res.body).toBeArrayOfSize(1);
            expect(testPick2.equals(res.body[0])).toBeTrue();
            expect(res.body[0].id).toEqual(2);
        });
        it("should throw a 404 error if no pick with that query is found", async () => {
            await findRequest({ round: 4 }, 404);
        });
    });

    describe("PUT /picks/:id (update one pick)", () => {
        const putRequest = (id: number, pickObj: Partial<DraftPick>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<DraftPick>>(agent, `/picks/${id}`, pickObj, status);
        const updatedPickObj = {...testPickObj, season: 2018, id: 1};
        const updatedPick = new DraftPick(updatedPickObj);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated pick", async () => {
            const res = await adminLoggedIn(putRequest(updatedPickObj.id, updatedPickObj), app);
            expect(updatedPick.equals(res.body)).toBeTrue();

            // Confirm db was actually updated:
            const getOnePick = await request(app).get(`/picks/${updatedPickObj.id}`).expect(200);
            expect(updatedPick.equals(getOnePick.body)).toBeTrue();
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const invalidObj = {...updatedPickObj, id: 1, blah: "wassup"};
            await adminLoggedIn(putRequest(invalidObj.id, invalidObj, 400), app);

            // Confirm db was not updated:
            const existingPick = await request(app).get(`/picks/${invalidObj.id}`).expect(200);
            expect(updatedPick.equals(existingPick.body)).toBeTrue();
            expect(existingPick.body.blah).toBeUndefined();
        });
        it("should throw a 404 Not Found error if there is no pick with that ID", async () => {
            await adminLoggedIn(putRequest(999, updatedPickObj, 404), app);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to update a pick", async () => {
            await ownerLoggedIn(putRequest(updatedPickObj.id, updatedPickObj, 403), app);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await putRequest(updatedPickObj.id, updatedPickObj, 403)(request(app));
        });
    });

    describe("DELETE /picks/:id (delete one pick)", () => {
        const deleteRequest = (id: number, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/picks/${id}`, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const res = await adminLoggedIn(deleteRequest(1), app);
            expect(res.body).toEqual({deleteCount: 1, id: 1});

            // Confirm that it was deleted from the db:
            const getAllRes = await request(app).get("/picks").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1);
        });
        it("should throw a 404 Not Found error if there is no pick with that ID", async () => {
            await adminLoggedIn(deleteRequest(1, 404), app);
            const getAllRes = await request(app).get("/picks").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to delete a pick", async () => {
            await ownerLoggedIn(deleteRequest(2, 403), app);
            const getAllRes = await request(app).get("/picks").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await deleteRequest(2, 403)(request(app));
            const getAllRes = await request(app).get("/picks").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1);
        });
    });

    describe("POST /batch (batch add new draft picks via csv file)", () => {
        const csv = `${process.env.BASE_DIR}/tests/resources/three-player-50-picks.csv`;
        const postFileRequest = (filePath: string, mode?: WriteMode, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                agent
                    .post(`/picks/batch${mode ? "?mode=" + mode : ""}`)
                    .attach("picks", filePath)
                    .expect("Content-Type", /json/)
                    .expect(status);
        const requestWithoutFile = (mode?: WriteMode, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                agent
                    .post(`/picks/batch${mode ? "?mode=" + mode : ""}`)
                    .expect("Content-Type", /json/)
                    .expect(status);

        it("should append by default", async () => {
            const getAllRes = await request(app).get("/picks").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1);

            const batchPutRes = await adminLoggedIn(postFileRequest(csv), app);
            expect(batchPutRes.body).toBeArrayOfSize(50);
            const afterGetAllRes = await request(app).get("/picks").expect(200);
            expect(afterGetAllRes.body).toBeArrayOfSize(51);
        });
        it("should append with the given mode passed in", async () => {
            const getAllRes = await request(app).get("/picks").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(51);

            const batchPutRes = await adminLoggedIn(postFileRequest(csv, "append"), app);
            expect(batchPutRes.body).toBeArrayOfSize(50);
            const afterGetAllRes = await request(app).get("/picks").expect(200);
            expect(afterGetAllRes.body).toBeArrayOfSize(101);
        });
        it("should overwrite with the given mode passed in", async () => {
            const getAllRes = await request(app).get("/picks").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(101);

            const batchPutRes = await adminLoggedIn(postFileRequest(csv, "overwrite"), app);
            expect(batchPutRes.body).toBeArrayOfSize(50);
            const afterGetAllRes = await request(app).get("/picks").expect(200);
            expect(afterGetAllRes.body).toBeArrayOfSize(50);
        });
        it("should return a 400 Bad Request if no file is passed in", async () => {
            await (adminLoggedIn(requestWithoutFile("overwrite", 400), app));
        });
        it("should return a 403 Forbidden error if a non-admin tries to upload new picks", async () => {
            await ownerLoggedIn(postFileRequest(csv, "overwrite", 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged-in request is used", async () => {
            await postFileRequest(csv, "overwrite", 403)(request(app));
        });
    });
});
