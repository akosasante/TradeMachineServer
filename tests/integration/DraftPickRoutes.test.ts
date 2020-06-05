import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import { WriteMode } from "../../src/csv/CsvUtils";
import TeamDAO from "../../src/DAO/TeamDAO";
import UserDAO from "../../src/DAO/UserDAO";
import DraftPick, { LeagueLevel } from "../../src/models/draftPick";
import Team from "../../src/models/team";
import User, { Role } from "../../src/models/user";
import { DraftPickFactory } from "../factories/DraftPickFactory";
import { TeamFactory } from "../factories/TeamFactory";
import {
    adminLoggedIn, DatePatternRegex, doLogout, makeDeleteRequest, makeGetRequest, makePostRequest,
    makePutRequest, ownerLoggedIn, setupOwnerAndAdminUsers, stringifyQuery
} from "./helpers";
import { v4 as uuid } from "uuid";
import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
import startServer from "../../src/bootstrap/app";

dotenvConfig({path: resolvePath(__dirname, "../.env")});


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
    app = await startServer();

    const userDAO = new UserDAO();
    const teamDAO = new TeamDAO();
    // Create admin and owner users in db for rest of this suite's use
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
    await userDAO.updateUser(adminUser.id!, { displayName: "Cam", csvName: "Cam" });
    await userDAO.updateUser(ownerUser.id!, { displayName: "A", csvName: "Akos" });
    // Create users and teams for batch upload tests
    [user3] = await userDAO.createUsers([{ email: "kwasi@example.com", password: "lol", displayName: "K",
        role: Role.OWNER, csvName: "Kwasi"}]);
    [team1, team2, team3] = await teamDAO.createTeams([
        TeamFactory.getTeamObject( "Camtastic", 1, {owners: [adminUser]}),
        TeamFactory.getTeamObject( "Squad", 2, {owners: [ownerUser]}),
        TeamFactory.getTeamObject( "Asantes", 3, {owners: [user3]}),
    ]);

    await teamDAO.updateTeamOwners(team1.id!, [adminUser], []);
    await teamDAO.updateTeamOwners(team2.id!, [ownerUser], []);
    await teamDAO.updateTeamOwners(team3.id!, [user3], []);
});
afterAll(async () => {
    logger.debug("~~~~~~DRAFT PICK ROUTES AFTER ALL~~~~~~");
    await shutdown();
    app.close(() => {
        logger.debug("CLOSED SERVER");
    });
});

describe("Pick API endpoints", () => {
    const testPick = DraftPickFactory.getPick(undefined, undefined, LeagueLevel.HIGH);
    const testPick2 =  DraftPickFactory.getPick(2, 6, LeagueLevel.MAJORS);

    describe("POST /picks (create new pick)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (pickObjs: Partial<DraftPick>[], status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<DraftPick>[]>(agent, "/picks", pickObjs, status);
        const getOneRequest = (id: number, status: number = 200) =>
            makeGetRequest(request(app), `/picks/${id}`, status);

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single pick object based on object passed in", async () => {
            const {body} = await adminLoggedIn(postRequest([testPick.parse()]), app);
            const expected = {...testPick,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };
            expect(body[0]).toMatchObject(expected);
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const testInvalidProps = {...testPick2.parse(), blah: "Hello"};
            const {body} = await adminLoggedIn(postRequest([testInvalidProps]), app);
            const {body: getBody} = await getOneRequest(body[0].id);
            const expected = {...testPick2,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };

            expect(getBody).toMatchObject(expected);
            expect(getBody.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const pickObj = { season: 2017 };
            const {body} = await adminLoggedIn(postRequest([pickObj], 400), app);
            expect(body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a pick", async () => {
            await ownerLoggedIn(postRequest([testPick.parse()], 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest([testPick.parse()], 403)(request(app));
        });
    });

    describe("GET /picks[?include=draftType] (get all picks)", () => {
        const getAllRequest = (param: string = "", status: number = 200) =>
            makeGetRequest(request(app), `/picks${param}`, status);

        it("should return an array of all picks in the db", async () => {
            const {body} = await getAllRequest();
            const expected = {...testPick,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };
            const returnedPick = body.find((pick: DraftPick) => pick.id === testPick.id);
            expect(body).toBeArrayOfSize(2);
            expect(returnedPick).toMatchObject(expected);
        });
        it("should return an array of all picks in a given league or leagues", async () => {
            const {body: highPicks} = await getAllRequest("?include[]=high");
            const {body: highMajorPicks} = await getAllRequest("?include[]=high&include[]=majors");
            const expected = {...testPick,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };

            expect(highPicks).toBeArrayOfSize(1);
            expect(highMajorPicks).toBeArrayOfSize(2);
            expect(highPicks[0]).toMatchObject(expected);
            expect(highMajorPicks).toSatisfyAll((pick: DraftPick) => pick.id === testPick.id || pick.id === testPick2.id);
        });
    });

    describe("GET /picks/:id (get one pick)", () => {
        const getOneRequest = (id: string, status: number = 200) =>
            makeGetRequest(request(app), `/picks/${id}`, status);

        it("should return a single pick for the given id", async () => {
            const {body} = await getOneRequest(testPick.id!);
            const expected = {...testPick,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };

            expect(body).toBeObject();
            expect(body).toMatchObject(expected);
        });
        it("should throw a 404 Not Found error if there is no pick with that ID", async () => {
            await getOneRequest(uuid(), 404);
        });
    });

    describe("GET /picks/search?queryOpts (get picks by query)", () => {
        const findRequest = (query: Partial<DraftPick>, status: number = 200) =>
            makeGetRequest(request(app), `/picks/search${stringifyQuery(query as {[key: string]: string})}`, status);

        it("should return picks for the given query", async () => {
            const {body} = await findRequest({round: 2});
            const expected = {...testPick2,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };

            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject(expected);
        });
        it("should throw a 404 error if no pick with that query is found", async () => {
            await findRequest({ round: 4 }, 404);
        });
    });

    describe("PUT /picks/:id (update one pick)", () => {
        const putRequest = (id: string, pickObj: Partial<DraftPick>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<DraftPick>>(agent, `/picks/${id}`, pickObj, status);
        const updatedPickObj = {season: 2018};
        const updatedPick = new DraftPick({...testPick, ...updatedPickObj});
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated pick", async () => {
            const {body} = await adminLoggedIn(putRequest(updatedPick.id!, updatedPickObj), app);
            const expected = {...updatedPick,
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
            };

            expect(body).toMatchObject(expected);
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const invalidObj = {...updatedPickObj, blah: "wassup"};
            await adminLoggedIn(putRequest(testPick.id!, invalidObj, 400), app);

            // Confirm db was not updated:
            const {body: getOneBody} = await request(app).get(`/picks/${testPick.id}`).expect(200);
            expect(getOneBody).toMatchObject(updatedPick);
            expect(getOneBody.blah).toBeUndefined();
        });
        it("should throw a 404 Not Found error if there is no pick with that ID", async () => {
            await adminLoggedIn(putRequest(uuid(), updatedPickObj, 404), app);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to update a pick", async () => {
            await ownerLoggedIn(putRequest(uuid(), updatedPickObj, 403), app);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await putRequest(uuid(), updatedPickObj, 403)(request(app));
        });
    });

    describe("DELETE /picks/:id (delete one pick)", () => {
        const deleteRequest = (id: string, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/picks/${id}`, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const {body} = await adminLoggedIn(deleteRequest(testPick.id!), app);
            expect(body).toEqual({deleteCount: 1, id: testPick.id});

            // Confirm that it was deleted from the db:
            const {body: getAllRes} = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
        it("should throw a 404 Not Found error if there is no pick with that ID", async () => {
            await adminLoggedIn(deleteRequest(testPick.id!, 404), app);
            const {body: getAllRes} = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to delete a pick", async () => {
            await ownerLoggedIn(deleteRequest(testPick.id!, 403), app);
            const {body: getAllRes} = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await deleteRequest(testPick.id!, 403)(request(app));
            const {body: getAllRes} = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
    });

    describe("POST /batch (batch add new draft picks via csv file)", () => {
        const csv1 = `${process.env.BASE_DIR}/tests/resources/three-player-25-picks-1.csv`;
        const csv2 = `${process.env.BASE_DIR}/tests/resources/three-player-25-picks-2.csv`;
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
            const {body: getAllRes} = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);

            const {body: batchPutRes} = await adminLoggedIn(postFileRequest(csv1), app);
            expect(batchPutRes).toBeArrayOfSize(33);
            const {body: afterGetAllRes} = await request(app).get("/picks").expect(200);
            expect(afterGetAllRes).toBeArrayOfSize(34);
        });
        it("should append with the given mode passed in", async () => {
            const {body: getAllRes} = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(34);

            const {body: batchPutRes} = await adminLoggedIn(postFileRequest(csv2, "append"), app);
            expect(batchPutRes).toBeArrayOfSize(17);
            const {body: afterGetAllRes} = await request(app).get("/picks").expect(200);
            expect(afterGetAllRes).toBeArrayOfSize(51);
        });
        it("should overwrite with the given mode passed in", async () => {
            const {body: getAllRes} = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(51);

            const {body: batchPutRes} = await adminLoggedIn(postFileRequest(csv1, "overwrite"), app);
            expect(batchPutRes).toBeArrayOfSize(33);
            const {body: afterGetAllRes} = await request(app).get("/picks").expect(200);
            expect(afterGetAllRes).toBeArrayOfSize(33);
        });
        it("should return a 400 Bad Request if no file is passed in", async () => {
            await (adminLoggedIn(requestWithoutFile("overwrite", 400), app));
        });
        it("should return a 403 Forbidden error if a non-admin tries to upload new picks", async () => {
            await ownerLoggedIn(postFileRequest(csv1, "overwrite", 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged-in request is used", async () => {
            await postFileRequest(csv1, "overwrite", 403)(request(app));
        });
    });
});
