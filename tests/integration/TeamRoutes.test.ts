import { Server } from "http";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import UserDAO from "../../src/DAO/UserDAO";
import Team from "../../src/models/team";
import { TeamFactory } from "../factories/TeamFactory";
import { UserFactory } from "../factories/UserFactory";
import { v4 as uuid } from "uuid";
import {
    adminLoggedIn,
    clearDb,
    DatePatternRegex,
    doLogout,
    makeDeleteRequest,
    makeGetRequest,
    makePatchRequest,
    makePostRequest,
    makePutRequest,
    ownerLoggedIn,
    setupOwnerAndAdminUsers,
    stringifyQuery,
} from "./helpers";
import startServer from "../../src/bootstrap/app";
import User from "../../src/models/user";
import TeamDAO from "../../src/DAO/TeamDAO";
import { getConnection } from "typeorm";

let app: Server;
let ownerUser: User;
let adminUser: User;
let otherUser: User;
let userDAO: UserDAO;
let teamDAO: TeamDAO;

async function shutdown() {
    try {
        await redisClient.disconnect();
    } catch (err) {
        logger.error(`Error while closing redis: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~TEAM ROUTES BEFORE ALL~~~~~~");
    app = await startServer();

    userDAO = new UserDAO();
    teamDAO = new TeamDAO();
    return app;
}, 5000);

afterAll(async () => {
    logger.debug("~~~~~~TEAM ROUTES AFTER ALL~~~~~~");
    const shutdownRedis = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownRedis;
});

describe("Team API endpoints", () => {
    beforeEach(async () => {
        // Create admin and owner users in db for rest of this suite's use
        [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
        [otherUser] = await userDAO.createUsers([UserFactory.getUser().parse()]);
        return otherUser;
    });

    afterEach(async () => {
        return await clearDb(getConnection(process.env.ORM_CONFIG));
    });

    describe("POST /teams (create new team)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest =
            (teamObjs: Partial<Team>[], status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Team>[]>(agent, "/teams", teamObjs, status);
        const getOneRequest = (id: string, status = 200) => makeGetRequest(request(app), `/teams/${id}`, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return a list of team objects based on the object(s) passed in", async () => {
            const testTeam1 = TeamFactory.getTeam();

            const { body } = await adminLoggedIn(postRequest([testTeam1.parse()]), app);

            expect(body[0]).toMatchObject(testTeam1);
        }, 2000);
        it("should ignore any invalid properties from the object passed in", async () => {
            const testTeam1 = TeamFactory.getTeam();

            const { body: createBody } = await adminLoggedIn(
                postRequest([
                    {
                        ...testTeam1.parse(),
                        blah: "bloop",
                    } as Partial<Team>,
                ]),
                app
            );
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const { body } = await getOneRequest(createBody[0].id);

            expect(body).toMatchObject({ ...testTeam1.parse(), owners: expect.any(Array) });
            expect(body.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const { body } = await adminLoggedIn(postRequest([{ espnId: 3 }], 400), app);

            expect(body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a team", async () => {
            const testTeam1 = TeamFactory.getTeam();

            await ownerLoggedIn(postRequest([testTeam1.parse()], 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            const testTeam1 = TeamFactory.getTeam();

            await postRequest([testTeam1.parse()], 403)(request(app));
        });
    });

    describe("GET /teams (get all teams)", () => {
        const getAllRequest = (status = 200) => makeGetRequest(request(app), "/teams", status);
        const getAllOwnerRequest = (condition: string, status = 200) =>
            makeGetRequest(request(app), `/teams?hasOwners=${condition}`, status);

        it("should return an array of all teams (public vers.) in the db", async () => {
            const teams = [TeamFactory.getTeam(), TeamFactory.getTeam("Team Two", 2)];
            await teamDAO.createTeams(teams.map(t => t.parse()));

            const { body } = await getAllRequest();

            expect(body).toBeArrayOfSize(2);
            expect(body.map((returnedTeam: Team) => returnedTeam.id)).toIncludeSameMembers(teams.map(t => t.id));
        });
        it("should return an array of all teams with owners", async () => {
            const teams = [TeamFactory.getTeam(), TeamFactory.getTeam("Team Two", 2)];
            await teamDAO.createTeams(teams.map(t => t.parse()));
            await teamDAO.updateTeamOwners(teams[1].parse().id!, [ownerUser, otherUser], []);

            const { body } = await getAllOwnerRequest("true");

            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject(teams[1]);
        });
        it("should return an array of all teams without owners", async () => {
            const teams = [TeamFactory.getTeam().parse(), TeamFactory.getTeam("Team Two", 2).parse()];
            await teamDAO.createTeams(teams);
            await teamDAO.updateTeamOwners(teams[1].id!, [ownerUser, otherUser], []);

            const { body } = await getAllOwnerRequest("false");

            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject({
                ...teams[0],
                owners: expect.any(Array),
                dateCreated: expect.stringMatching(DatePatternRegex),
                dateModified: expect.stringMatching(DatePatternRegex),
                status: expect.toBeNumber(),
            });
        });
    });

    describe("GET /teams/:id (get one team)", () => {
        const getOneRequest = (id: string, status = 200) => makeGetRequest(request(app), `/teams/${id}`, status);

        it("should return a single team (public vers.) for the given id", async () => {
            const testTeam1 = TeamFactory.getTeam();
            await teamDAO.createTeams([testTeam1.parse()]);

            const { body } = await getOneRequest(testTeam1.id!);

            expect(body).toBeObject();
            expect(body).toMatchObject(testTeam1);
        });
        it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await getOneRequest(uuid(), 404);
        });
    });

    describe("GET /teams/search?queryOpts (get team by query)", () => {
        const findRequest = (query: Partial<Team>, status = 200) =>
            makeGetRequest(request(app), `/teams/search${stringifyQuery(query as { [key: string]: string })}`, status);

        it("should return teams (public vers.) for the given query", async () => {
            const teams = [TeamFactory.getTeam(), TeamFactory.getTeam("Team Two", 2)];
            await teamDAO.createTeams(teams.map(t => t.parse()));

            const { body } = await findRequest({ espnId: 2 });

            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject(teams[1]);
        });
        it("should throw a 404 error if no team with that query is found", async () => {
            await findRequest({ espnId: 999 }, 404);
        });
    });

    describe("PUT /teams/:id (update one team)", () => {
        const putTeamRequest =
            (id: string, teamObj: Partial<Team>, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<Team>>(agent, `/teams/${id}`, teamObj, status);
        const updatedTeamObj = { name: "Hello darkness my old friend" };

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return the updated team", async () => {
            const testTeam1 = TeamFactory.getTeam();
            await teamDAO.createTeams([testTeam1.parse()]);

            const { body } = await adminLoggedIn(putTeamRequest(testTeam1.id!, updatedTeamObj), app);

            expect(body).toMatchObject(new Team({ ...testTeam1, ...updatedTeamObj }));
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const testTeam1 = TeamFactory.getTeam();
            await teamDAO.createTeams([testTeam1.parse()]);
            const teamObj = { ...updatedTeamObj, blah: "wassup" };

            await adminLoggedIn(putTeamRequest(testTeam1.id!, teamObj, 400), app);

            // Confirm db was not updated:
            const { body: getOneBody } = await request(app).get(`/teams/${testTeam1.id}`).expect(200);
            expect(getOneBody).toMatchObject(testTeam1);
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
        const patchTeamRequest =
            (id: string, ownersToAdd: User[], ownersToRemove: User[], status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePatchRequest(agent, `/teams/${id}`, { add: ownersToAdd, remove: ownersToRemove }, status);
        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return the updated team with added owners", async () => {
            const testTeam1 = TeamFactory.getTeam();
            await teamDAO.createTeams([testTeam1.parse()]);

            const { body } = await adminLoggedIn(patchTeamRequest(testTeam1.id!, [otherUser, adminUser], []), app);

            expect(body.owners).toBeArrayOfSize(2);
            expect(body.owners.map((owner: User) => owner.id)).toIncludeSameMembers([adminUser.id, otherUser.id]);
        });
        it("should allow adding and removing at the same time", async () => {
            const testTeam1 = TeamFactory.getTeam();
            await teamDAO.createTeams([testTeam1.parse()]);
            await teamDAO.updateTeamOwners(testTeam1.id!, [otherUser, adminUser], []);

            const { body } = await adminLoggedIn(patchTeamRequest(testTeam1.id!, [ownerUser], [otherUser]), app);

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
        const deleteTeamRequest =
            (id: string, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makeDeleteRequest(agent, `/teams/${id}`, status);
        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const teams = [TeamFactory.getTeam(), TeamFactory.getTeam("Team Two", 2)];
            await teamDAO.createTeams(teams.map(t => t.parse()));

            const { body } = await adminLoggedIn(deleteTeamRequest(teams[0].id!), app);
            expect(body).toEqual({ deleteCount: 1, id: teams[0].id });

            // Confirm that it was deleted from the db:
            const { body: getAllRes } = await request(app).get("/teams").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
            expect(getAllRes[0].id).toEqual(teams[1].id);
        });
        it("should reset the team_id field of any owner users of deleted teams", async () => {
            const testTeam1 = TeamFactory.getTeam();
            await teamDAO.createTeams([testTeam1.parse()]);
            await teamDAO.updateTeamOwners(testTeam1.id!, [otherUser], []);

            // user has been updated with team id
            const { body: bodyBefore } = await request(app).get("/users?full=true").expect(200);
            const otherUserWithTeamId = bodyBefore.find((u: User) => u.id === otherUser.id);
            expect(otherUserWithTeamId.team.id).toEqual(testTeam1.id);

            // delete owned team
            await adminLoggedIn(deleteTeamRequest(testTeam1.id!), app);

            // confirm that user's team id has been set to null
            const { body: bodyAfter } = await request(app).get("/users?full=true").expect(200);
            const otherUserWithoutTeamId = bodyAfter.find((u: User) => u.id === otherUser.id);
            expect(otherUserWithoutTeamId.team).toBeNull();
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
