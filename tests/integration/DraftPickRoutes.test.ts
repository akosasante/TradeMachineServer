import { Server } from "http";
import "jest-extended";
// @ts-ignore
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import { WriteMode } from "../../src/csv/CsvUtils";
import TeamDAO from "../../src/DAO/TeamDAO";
import UserDAO from "../../src/DAO/UserDAO";
import DraftPick, { LeagueLevel } from "../../src/models/draftPick";
import User, { Role } from "../../src/models/user";
import { DraftPickFactory } from "../factories/DraftPickFactory";
import { TeamFactory } from "../factories/TeamFactory";
import {
    adminLoggedIn,
    clearDb,
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
import { getConnection } from "typeorm";
import DraftPickDAO from "../../src/DAO/DraftPickDAO";

let app: Server;
let adminUser: User;
let ownerUser: User;
let userDAO: UserDAO;
let teamDAO: TeamDAO;
let pickDAO: DraftPickDAO;

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment,  @typescript-eslint/no-unsafe-call */
async function shutdown() {
    await new Promise<void>((resolve, reject) => {
        redisClient.quit((err, reply) => {
            if (err) {
                reject(err);
            } else {
                logger.debug(`Redis quit successfully with reply ${reply}`);
                resolve();
            }
        });
    });
    // redis.quit() creates a thread to close the connection.
    // We wait until all threads have been run once to ensure the connection closes.
    return await new Promise(resolve => setImmediate(resolve));
}

beforeAll(async () => {
    logger.debug("~~~~~~DRAFT PICK ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    userDAO = new UserDAO();
    teamDAO = new TeamDAO();
    pickDAO = new DraftPickDAO();

    return app;
}, 5000);

afterAll(async () => {
    logger.debug("~~~~~~DRAFT PICK ROUTES AFTER ALL~~~~~~");
    const shutdownRedis = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownRedis;
});

describe("Pick API endpoints", () => {
    beforeEach(async () => {
        // Create admin and owner users in db for rest of this suite's use
        [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
        return adminUser;
    });

    afterEach(async () => {
        return await clearDb(getConnection(process.env.ORM_CONFIG));
    });

    describe("POST /picks (create new pick)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (pickObjs: Partial<DraftPick>[], status = 200) => (
            agent: request.SuperTest<request.Test>
        ) => makePostRequest<Partial<DraftPick>[]>(agent, "/picks", pickObjs, status);
        const getOneRequest = (id: number, status = 200) => makeGetRequest(request(app), `/picks/${id}`, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return pick objects based on object(s) passed in", async () => {
            const testPick1 = DraftPickFactory.getPick();
            await teamDAO.createTeams([testPick1.originalOwner!.parse()]);

            const { body } = await adminLoggedIn(postRequest([testPick1.parse()]), app);

            expect(body[0]).toMatchObject(testPick1);
        });
        it("should ignore any invalid properties from the object(s) passed in", async () => {
            const testPick1 = DraftPickFactory.getPick();
            await teamDAO.createTeams([testPick1.originalOwner!.parse()]);

            const { body } = await adminLoggedIn(
                postRequest([
                    {
                        ...testPick1.parse(),
                        blah: "Hello",
                    } as Partial<DraftPick>,
                ]),
                app
            );
            const { body: getBody } = await getOneRequest(body[0].id);

            expect(getBody).toMatchObject(testPick1);
            expect(getBody.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const { body } = await adminLoggedIn(postRequest([{ season: 2017 }], 400), app);

            expect(body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a pick", async () => {
            const testPick1 = DraftPickFactory.getPick();
            await teamDAO.createTeams([testPick1.originalOwner!.parse()]);

            await ownerLoggedIn(postRequest([testPick1.parse()], 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            const testPick1 = DraftPickFactory.getPick();
            await teamDAO.createTeams([testPick1.originalOwner!.parse()]);

            await postRequest([testPick1.parse()], 403)(request(app));
        });
    });

    describe("GET /picks[?include=draftType]&season (get all picks)", () => {
        const getAllRequest = (param = "", status = 200) => makeGetRequest(request(app), `/picks${param}`, status);

        it("should return an array of all picks in the db", async () => {
            const picks = [DraftPickFactory.getPick(), DraftPickFactory.getPick(2, 6, LeagueLevel.MAJORS)];
            await teamDAO.createTeams(picks.map((p, i) => ({ ...p.originalOwner!.parse(), espnId: i })));
            await pickDAO.createPicks(picks.map(p => p.parse()));

            const { body } = await getAllRequest();

            expect(body).toBeArrayOfSize(2);
            expect(body.map((returnedPick: DraftPick) => returnedPick.id)).toIncludeSameMembers(picks.map(p => p.id));
        });
        it("should return an array of all picks in a given league or leagues", async () => {
            const picks = [
                DraftPickFactory.getPick(),
                DraftPickFactory.getPick(2, 6, LeagueLevel.MAJORS),
                DraftPickFactory.getPick(1, 1, LeagueLevel.HIGH),
            ];
            await teamDAO.createTeams(picks.map((p, i) => ({ ...p.originalOwner!.parse(), espnId: i })));
            await pickDAO.createPicks(picks.map(p => p.parse()));

            const { body: highPicks } = await getAllRequest("?include[]=high");
            const { body: highMajorPicks } = await getAllRequest("?include[]=high&include[]=majors");

            expect(highPicks).toBeArrayOfSize(1);
            expect(highMajorPicks).toBeArrayOfSize(2);
            expect(highPicks[0].id).toEqual(picks[2].id);
            expect(highMajorPicks.map((returnedPick: DraftPick) => returnedPick.id)).toIncludeSameMembers(
                picks.slice(1).map(p => p.id)
            );
        });
        it("should return an array of all picks in a given season", async () => {
            const picks = [
                DraftPickFactory.getPick(),
                DraftPickFactory.getPick(2, 6, LeagueLevel.MAJORS),
                DraftPickFactory.getPick(1, 1, LeagueLevel.HIGH),
                DraftPickFactory.getPick(3, 6, LeagueLevel.MAJORS, 2021),
                DraftPickFactory.getPick(3, 1, LeagueLevel.HIGH, 2021),
            ];
            await teamDAO.createTeams(picks.map((p, i) => ({ ...p.originalOwner!.parse(), espnId: i })));
            await pickDAO.createPicks(picks.map(p => p.parse()));

            const { body: picksFrom2020 } = await getAllRequest("?season=2021");

            expect(picksFrom2020).toBeArrayOfSize(2);
            expect(picksFrom2020.map((returnedPick: DraftPick) => returnedPick.id)).toIncludeSameMembers(
              picks.slice(3).map(p => p.id)
            );
        });
        it("should return an array of all picks in a given league or leagues and season", async () => {
            const picks = [
                DraftPickFactory.getPick(),
                DraftPickFactory.getPick(2, 6, LeagueLevel.MAJORS),
                DraftPickFactory.getPick(1, 1, LeagueLevel.HIGH),
                DraftPickFactory.getPick(3, 6, LeagueLevel.MAJORS, 2021),
                DraftPickFactory.getPick(3, 1, LeagueLevel.HIGH, 2021),
            ];
            await teamDAO.createTeams(picks.map((p, i) => ({ ...p.originalOwner!.parse(), espnId: i })));
            await pickDAO.createPicks(picks.map(p => p.parse()));

            const { body: highPicks } = await getAllRequest("?include[]=high&season=2021");
            const { body: highMajorPicks } = await getAllRequest("?include[]=high&include[]=majors&season=2021");

            expect(highPicks).toBeArrayOfSize(1);
            expect(highMajorPicks).toBeArrayOfSize(2);
            expect(highPicks[0].id).toEqual(picks[4].id);
            expect(highMajorPicks.map((returnedPick: DraftPick) => returnedPick.id)).toIncludeSameMembers(
                picks.slice(3).map(p => p.id)
            );
        });
    });

    describe("GET /picks/:id (get one pick)", () => {
        const getOneRequest = (id: string, status = 200) => makeGetRequest(request(app), `/picks/${id}`, status);

        it("should return a single pick for the given id", async () => {
            const picks = [DraftPickFactory.getPick(), DraftPickFactory.getPick(2, 6, LeagueLevel.MAJORS)];
            await teamDAO.createTeams(picks.map((p, i) => ({ ...p.originalOwner!.parse(), espnId: i })));
            await pickDAO.createPicks(picks.map(p => p.parse()));

            const { body } = await getOneRequest(picks[0].id!);

            expect(body).toBeObject();
            expect(body).toMatchObject({ ...picks[0], originalOwner: expect.toBeObject() });
        });
        it("should throw a 404 Not Found error if there is no pick with that ID", async () => {
            await getOneRequest(uuid(), 404);
        });
    });

    describe("GET /picks/search?queryOpts (get picks by query)", () => {
        const findRequest = (query: Partial<DraftPick>, status = 200) =>
            makeGetRequest(request(app), `/picks/search${stringifyQuery(query as { [key: string]: string })}`, status);

        it("should return picks for the given query", async () => {
            const picks = [DraftPickFactory.getPick(), DraftPickFactory.getPick(2, 6, LeagueLevel.MAJORS)];
            await teamDAO.createTeams(picks.map((p, i) => ({ ...p.originalOwner!.parse(), espnId: i })));
            await pickDAO.createPicks(picks.map(p => p.parse()));

            const { body } = await findRequest({ round: 2 });

            expect(body).toBeArrayOfSize(1);
            expect(body).toMatchObject([{ ...picks[1], originalOwner: expect.toBeObject() }]);
        });
        it("should throw a 404 error if no pick with that query is found", async () => {
            await findRequest({ round: 4 }, 404);
        });
    });

    describe("PUT /picks/:id (update one pick)", () => {
        const putRequest = (id: string, pickObj: Partial<DraftPick>, status = 200) => (
            agent: request.SuperTest<request.Test>
        ) => makePutRequest<Partial<DraftPick>>(agent, `/picks/${id}`, pickObj, status);
        const updatedPickObj = { season: 2018 };

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return the updated pick", async () => {
            const testPick1 = DraftPickFactory.getPick();
            await teamDAO.createTeams([testPick1.originalOwner!.parse()]);
            await pickDAO.createPicks([testPick1.parse()]);

            const { body } = await adminLoggedIn(putRequest(testPick1.id!, updatedPickObj), app);

            expect(body).toMatchObject({ ...testPick1, ...updatedPickObj });
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const testPick1 = DraftPickFactory.getPick();
            await teamDAO.createTeams([testPick1.originalOwner!.parse()]);
            await pickDAO.createPicks([testPick1.parse()]);
            const invalidObj = { ...updatedPickObj, blah: "wassup" };

            await adminLoggedIn(putRequest(testPick1.id!, invalidObj, 400), app);

            // Confirm db was not updated:
            const { body: getOneBody } = await request(app).get(`/picks/${testPick1.id}`).expect(200);
            expect(getOneBody).toMatchObject(testPick1);
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
        const deleteRequest = (id: string, status = 200) => (agent: request.SuperTest<request.Test>) =>
            makeDeleteRequest(agent, `/picks/${id}`, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const testPick1 = DraftPickFactory.getPick();
            await teamDAO.createTeams([testPick1.originalOwner!.parse()]);
            await pickDAO.createPicks([testPick1.parse()]);

            const { body } = await adminLoggedIn(deleteRequest(testPick1.id!), app);
            expect(body).toEqual({ deleteCount: 1, id: testPick1.id });

            // Confirm that it was deleted from the db:
            const { body: getAllRes } = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(0);
        });
        it("should throw a 404 Not Found error if there is no pick with that ID", async () => {
            const testPick1 = DraftPickFactory.getPick();
            await teamDAO.createTeams([testPick1.originalOwner!.parse()]);
            await pickDAO.createPicks([testPick1.parse()]);

            await adminLoggedIn(deleteRequest(uuid(), 404), app);

            const { body: getAllRes } = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to delete a pick", async () => {
            const testPick1 = DraftPickFactory.getPick();
            await teamDAO.createTeams([testPick1.originalOwner!.parse()]);
            await pickDAO.createPicks([testPick1.parse()]);

            await ownerLoggedIn(deleteRequest(testPick1.id!, 403), app);

            const { body: getAllRes } = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            const testPick1 = DraftPickFactory.getPick();
            await teamDAO.createTeams([testPick1.originalOwner!.parse()]);
            await pickDAO.createPicks([testPick1.parse()]);

            await deleteRequest(testPick1.id!, 403)(request(app));

            const { body: getAllRes } = await request(app).get("/picks").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
    });

    describe("POST /batch (batch add new draft picks via csv file)", () => {
        const csv1 = `${process.env.BASE_DIR}/tests/resources/three-player-25-picks-1.csv`;
        const csv2 = `${process.env.BASE_DIR}/tests/resources/three-player-25-picks-2.csv`;
        const postFileRequest = (filePath: string, mode?: WriteMode, status = 200) => (
            agent: request.SuperTest<request.Test>
        ) =>
            agent
                .post(`/picks/batch${mode ? "?mode=" + mode : ""}`)
                .attach("picks", filePath)
                .expect("Content-Type", /json/)
                .expect(status);
        const requestWithoutFile = (mode?: WriteMode, status = 200) => (agent: request.SuperTest<request.Test>) =>
            agent
                .post(`/picks/batch${mode ? "?mode=" + mode : ""}`)
                .expect("Content-Type", /json/)
                .expect(status);

        beforeEach(async () => {
            // Updating + adding users for each of the owners in the test CSV file
            await userDAO.updateUser(adminUser.id!, { displayName: "Cam", csvName: "Cam" });
            await userDAO.updateUser(ownerUser.id!, { displayName: "A", csvName: "Akos" });

            const [kwasi] = await userDAO.createUsers([
                {
                    email: "kwasi@example.com",
                    password: "lol",
                    displayName: "K",
                    role: Role.OWNER,
                    csvName: "Kwasi",
                },
            ]);
            const [team1, team2, team3] = await teamDAO.createTeams([
                TeamFactory.getTeamObject("Camtastic", 2),
                TeamFactory.getTeamObject("Squad", 3),
                TeamFactory.getTeamObject("Asantes", 4),
            ]);

            await teamDAO.updateTeamOwners(team1.id!, [adminUser], []);
            await teamDAO.updateTeamOwners(team2.id!, [ownerUser], []);
            return await teamDAO.updateTeamOwners(team3.id!, [kwasi], []);
        });

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should append by default", async () => {
            const initialPick = DraftPickFactory.getPick();
            await teamDAO.createTeams([initialPick.originalOwner!.parse()]);
            await pickDAO.createPicks([initialPick.parse()]);

            const allPicksBefore = await pickDAO.getAllPicks(true);
            expect(allPicksBefore).toBeArrayOfSize(1);

            const { body: batchPutRes } = await adminLoggedIn(postFileRequest(csv1), app);
            expect(batchPutRes).toBeArrayOfSize(33);

            const allPicksAfter = await pickDAO.getAllPicks(true);
            expect(allPicksAfter).toBeArrayOfSize(34);
        });
        it("should append with the given mode passed in", async () => {
            const initialPick = DraftPickFactory.getPick();
            await teamDAO.createTeams([initialPick.originalOwner!.parse()]);
            await pickDAO.createPicks([initialPick.parse()]);

            const allPicksBefore = await pickDAO.getAllPicks(true);
            expect(allPicksBefore).toBeArrayOfSize(1);

            const { body: batchPutRes } = await adminLoggedIn(postFileRequest(csv2, "append"), app);
            expect(batchPutRes).toBeArrayOfSize(17);

            const allPicksAfter = await pickDAO.getAllPicks(true);
            expect(allPicksAfter).toBeArrayOfSize(18);
        });
        it("should overwrite with the given mode passed in", async () => {
            const initialPick = DraftPickFactory.getPick();
            await teamDAO.createTeams([initialPick.originalOwner!.parse()]);
            await pickDAO.createPicks([initialPick.parse()]);

            const allPicksBefore = await pickDAO.getAllPicks(true);
            expect(allPicksBefore).toBeArrayOfSize(1);

            const { body: batchPutRes } = await adminLoggedIn(postFileRequest(csv1, "overwrite"), app);
            expect(batchPutRes).toBeArrayOfSize(33);

            const allPicksAfter = await pickDAO.getAllPicks(true);
            expect(allPicksAfter).toBeArrayOfSize(33);
        });
        it("should return a 400 Bad Request if no file is passed in", async () => {
            await adminLoggedIn(requestWithoutFile("overwrite", 400), app);
        });
        it("should return a 403 Forbidden error if a non-admin tries to upload new picks", async () => {
            await ownerLoggedIn(postFileRequest(csv1, "overwrite", 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged-in request is used", async () => {
            await postFileRequest(csv1, "overwrite", 403)(request(app));
        });
    });
});
/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
