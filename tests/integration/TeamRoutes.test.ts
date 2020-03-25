import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import UserDAO from "../../src/DAO/UserDAO";
import Team from "../../src/models/team";
import { TeamFactory } from "../factories/TeamFactory";
import { UserFactory } from "../factories/UserFactory";
import { resolve as resolvePath } from "path";
import { v4 as uuid } from "uuid";
import { adminLoggedIn, DatePatternRegex, doLogout, makeDeleteRequest, makeGetRequest, makePatchRequest,
    makePostRequest, makePutRequest, ownerLoggedIn, setupOwnerAndAdminUsers, stringifyQuery } from "./helpers";
import { config as dotenvConfig } from "dotenv";
import startServer from "../../src/bootstrap/app";
import User from "../../src/models/user";

dotenvConfig({path: resolvePath(__dirname, "../.env")});

let app: Server;
let ownerUser: User;
let adminUser: User;
let otherUser: User;
let testTeam: Team;
let testTeam2: Team;
let ownerUserMatcher: object;
let otherUserMatcher: object;

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
    logger.debug("~~~~~~TEAM ROUTES BEFORE ALL~~~~~~");
    app = await startServer();

    // Create admin and owner users in db for rest of this suite's use
    const userDAO = new UserDAO();
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
    [otherUser] = await userDAO.createUsers([UserFactory.getUser().parse()]);
    testTeam = TeamFactory.getTeam();
    testTeam2 = TeamFactory.getTeam("Team Two", 2, {owners: [ownerUser, otherUser]});
});

afterAll(async () => {
    logger.debug("~~~~~~TEAM ROUTES AFTER ALL~~~~~~");
    await shutdown();
    app.close(() => {
        logger.debug("CLOSED SERVER");
    });
});

describe("Team API endpoints", () => {
    const updatedName = "Hello darkness my old friend";
    ownerUserMatcher = {...ownerUser, dateCreated: expect.stringMatching(DatePatternRegex), dateModified: expect.stringMatching(DatePatternRegex)};
    otherUserMatcher = {...otherUser, dateCreated: expect.stringMatching(DatePatternRegex), dateModified: expect.stringMatching(DatePatternRegex)};

    describe("POST /teams (create new team)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (teamObj: Partial<Team>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Team>>(agent, "/teams", teamObj, status);
        const getOneRequest = (id: number, status: number = 200) =>
            makeGetRequest(request(app), `/teams/${id}`, status);

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single team object based on the object passed in", async () => {
            const {body} = await adminLoggedIn(postRequest([testTeam.parse()]), app);
            expect(body[0]).toMatchObject(testTeam);
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const {body: createBody} = await adminLoggedIn(postRequest([{...testTeam2, blah: "bloop"}]), app);
            const {body} = await getOneRequest(createBody[0].id);
            expect(body).toMatchObject({...testTeam2.parse(), owners: expect.any(Array)});
            expect(body.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const {body} = await adminLoggedIn(postRequest([{ espnId: 3 }], 400), app);
            expect(body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a team", async () => {
            await ownerLoggedIn(postRequest(testTeam, 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest(testTeam, 403)(request(app));
        });
    });

    describe("GET /teams (get all teams)", () => {
        const getAllRequest = (status: number = 200) => makeGetRequest(request(app), "/teams", status);
        const getAllOwnerRequest = (condition: string, status: number = 200) =>
            makeGetRequest(request(app), `/teams?hasOwners=${condition}`, status);

        it("should return an array of all teams (public vers.) in the db", async () => {
            const {body} = await getAllRequest();
            expect(body).toBeArrayOfSize(2);
            expect(body.map((t: Team) => t.id)).toIncludeSameMembers([testTeam.id, testTeam2.id]);
        });
        it("should return an array of all teams with owners", async () => {
            const {body} = await getAllOwnerRequest("true");
            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject({...testTeam2.parse(), owners: expect.any(Array)});
        });
        it("should return an array of all teams without owners", async () => {
            const {body} = await getAllOwnerRequest("false");
            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject(testTeam);
        });
    });

    describe("GET /teams/:id (get one team)", () => {
        const getOneRequest = (id: string, status: number = 200) =>
            makeGetRequest(request(app), `/teams/${id}`, status);

        it("should return a single team (public vers.) for the given id", async () => {
            const {body} = await getOneRequest(testTeam.id!);
            expect(body).toBeObject();
            expect(body).toMatchObject(testTeam);
        });
        it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await getOneRequest(uuid(), 404);
        });
    });

    describe("GET /teams/search?queryOpts (get team by query)", () => {
        const findRequest = (query: Partial<Team>, status: number = 200) =>
            makeGetRequest(request(app), `/teams/search${stringifyQuery(query as { [key: string]: string; })}`, status);

        it("should return teams (public vers.) for the given query", async () => {
            const {body} = await findRequest({espnId: 2});
            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject({...testTeam2.parse(), owners: expect.any(Array)});
        });
        it("should throw a 404 error if no team with that query is found", async () => {
            await findRequest({ espnId: 999 }, 404);
        });
    });

    describe("PUT /teams/:id (update one team)", () => {
        const putTeamRequest = (id: string, teamObj: Partial<Team>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<Team>>(agent, `/teams/${id}`, teamObj, status);
        const updatedTeamObj = {name: updatedName};
        const updatedTeam = new Team({...testTeam, ...updatedTeamObj});
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated team", async () => {
            const {body} = await adminLoggedIn(putTeamRequest(testTeam.id!, updatedTeamObj), app);
            expect(body).toMatchObject(updatedTeam);
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const teamObj = {...updatedTeamObj, blah: "wassup"};
            await adminLoggedIn( putTeamRequest(testTeam.id!, teamObj, 400), app);

            // Confirm db was not updated:
            const {body: getOneBody} = await request(app).get(`/teams/${testTeam.id}`).expect(200);
            expect(getOneBody).toMatchObject(updatedTeam);
            expect(getOneBody.blah).toBeUndefined();
        });
        it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await adminLoggedIn(putTeamRequest(uuid(), updatedTeamObj, 404), app);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to update a team", async () => {
            await ownerLoggedIn(putTeamRequest(uuid(), updatedTeamObj, 403), app);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await putTeamRequest(uuid(), updatedTeamObj, 403)(request(app));
        });
    });

    describe("PATCH /teams/:id (edit a team's owners)", () => {
        const patchTeamRequest = (id: string, ownersToAdd: User[], ownersToRemove: User[], status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePatchRequest(agent, `/teams/${id}`, {add: ownersToAdd, remove: ownersToRemove}, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated team with added owners", async () => {
            const {body} = await adminLoggedIn(patchTeamRequest(testTeam.id!, [otherUser, adminUser], []), app);
            expect(body.owners).toBeArrayOfSize(2);
            expect(body.owners.map((owner: User) => owner.id)).toIncludeSameMembers([adminUser.id, otherUser.id]);
        });
        it("should allow adding and removing at the same time", async () => {
            const {body} = await adminLoggedIn(patchTeamRequest(testTeam.id!, [ownerUser], [otherUser]), app);
            expect(body.owners).toBeArrayOfSize(2);
            expect(body.owners.map((owner: User) => owner.id)).toIncludeSameMembers([adminUser.id, ownerUser.id]);
        });
        it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await adminLoggedIn(patchTeamRequest(uuid(), [otherUser], [], 404), app);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to update a team's owners", async () => {
            await ownerLoggedIn(patchTeamRequest(uuid(), [otherUser], [], 403), app);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await patchTeamRequest(uuid(), [otherUser], [], 403)(request(app));
        });
    });

    describe("DELETE /teams/:id (delete one team)", () => {
            const deleteTeamRequest = (id: string, status: number = 200) =>
                (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/teams/${id}`, status);
            afterEach(async () => {
                await doLogout(request.agent(app));
            });

            it("should return a delete result if successful", async () => {
            const {body} = await adminLoggedIn(deleteTeamRequest(testTeam.id!), app);
            expect(body).toEqual({ deleteCount: 1, id: testTeam.id });

            // Confirm that it was deleted from the db:
            const {body: getAllRes} = await request(app).get("/teams").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);

            // Confirm that users that were previously owners of this team have their TeamID set to none
        });
            it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await adminLoggedIn(deleteTeamRequest(uuid(), 404), app);
        });
            it("should throw a 403 Forbidden error if a non-admin tries to delete a team", async () => {
            await ownerLoggedIn(deleteTeamRequest(uuid(), 403), app);
        });
            it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await deleteTeamRequest(uuid(), 403)(request(app));
        });
    });
});
