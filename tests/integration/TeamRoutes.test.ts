import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import UserDAO from "../../src/DAO/UserDAO";
import Team from "../../src/models/team";
import User, { Role } from "../../src/models/user";
import server from "../../src/server";
import { doLogout, makeDeleteRequest, makeGetRequest, makeLoggedInRequest, makePatchRequest,
    makePostRequest, makePutRequest, stringifyQuery } from "./helpers";

let app: Server;
let adminUser: User;
let ownerUser: User;
let otherUser: User;
const adminUserObj = { email: "admin@example.com", password: "lol", name: "Cam", roles: [Role.ADMIN]};
const ownerUserObj = { email: "owner@example.com", password: "lol", name: "Jatheesh", roles: [Role.OWNER]};

beforeAll(async () => {
    app = await server;

    // Create admin and owner users in db for rest of this suite's use
    const userDAO = new UserDAO();
    adminUser = await userDAO.createUser({...adminUserObj});
    ownerUser = await userDAO.createUser({...ownerUserObj});
    otherUser = await userDAO.createUser({email: "example@test.ca"});
});
afterAll(async () => {
    await redisClient.quit();
});

describe("Team API endpoints", () => {
    const testTeamObj = {name: "Squirtle Squad", espnId: 1};
    const testTeam = new Team({name: "Squirtle Squad", espnId: 1});
    const updatedName = "Hello darkness my old friend";

    const adminLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), adminUserObj.email, adminUserObj.password, requestFn);
    const ownerLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), ownerUserObj.email, ownerUserObj.password, requestFn);

    describe("POST /teams (create new team)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (teamObj: Partial<Team>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Team>>(agent, "/teams", teamObj, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single team object based on the object passed in", async () => {
            const res = await adminLoggedIn(postRequest(testTeamObj));
            expect(testTeam.publicTeam.equals(res.body)).toBeTrue();
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const teamObj = {...testTeamObj, espnId: 2, blah: "Hello", bloop: "yeeah"};
            const testTeam2 = new Team(teamObj);
            const res = await adminLoggedIn(postRequest(teamObj));
            expect(testTeam2.publicTeam.equals(res.body)).toBeTrue();
            expect(res.body.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const teamObj = { espnId: 1 };
            const res = await adminLoggedIn(postRequest(teamObj, 400));
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a team", async () => {
            await ownerLoggedIn(postRequest(testTeamObj, 403));
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest(testTeamObj, 403)(request(app));
        });
    });

    describe("GET /teams (get all teams)", () => {
        const getAllRequest = (status: number = 200) => makeGetRequest(request(app), "/teams", status);
        const getAllOwnerRequest = (condition: string, status: number = 200) =>
            makeGetRequest(request(app), `/teams?hasOwners=${condition}`, status);

        it("should return an array of all teams (public vers.) in the db", async () => {
            const res = await getAllRequest();
            expect(testTeam.publicTeam.equals(res.body[0])).toBeTrue();
        });
        it("should return an array of all teams with owners or empty array otherwise", async () => {
            const res = await getAllOwnerRequest("true");
            expect(res.body).toBeArrayOfSize(0);
        });
        it("should return an array of all teams without owners or empty array otherwise", async () => {
            const res = await getAllOwnerRequest("false");
            expect(res.body).toBeArrayOfSize(2);
            expect(testTeam.publicTeam.equals(res.body[0])).toBeTrue();
        });
    });

    describe("GET /teams/:id (get one team)", () => {
        const getOneRequest = (id: number, status: number = 200) =>
            makeGetRequest(request(app), `/teams/${id}`, status);

        it("should return a single team (public vers.) for the given id", async () => {
            const res = await getOneRequest(1);
            expect(res.body).toBeObject();
            expect(testTeam.publicTeam.equals(res.body)).toBeTrue();
            expect(res.body.id).toEqual(1);
        });
        it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await getOneRequest(999, 404);
        });
    });

    describe("GET /teams/search?queryOpts (get team by query)", () => {
        const findRequest = (query: Partial<Team>, status: number = 200) =>
            makeGetRequest(request(app), `/teams/search${stringifyQuery(query)}`, status);

        it("should return teams (public vers.) for the given query", async () => {
            const res = await findRequest({espnId: 2});
            const testTeam2 = new Team({ id: 2, name: "Squirtle Squad", espnId: 2});

            expect(res.body).toBeArrayOfSize(1);
            expect(testTeam2.publicTeam.equals(res.body[0])).toBeTrue();
            expect(res.body[0].id).toEqual(2);
        });
        it("should throw a 404 error if no team with that query is found", async () => {
            await findRequest({ espnId: 999 }, 404);
        });
    });

    describe("UPDATE /teams/:id (update one team)", () => {
        const putTeamRequest = (id: number, teamObj: Partial<Team>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<Team>>(agent, `/teams/${id}`, teamObj, status);
        const updatedTeamObj = {...testTeamObj, id: 1, name: updatedName};
        const updatedTeam = new Team(updatedTeamObj);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated team (public vers.)", async () => {
            const res = await adminLoggedIn(putTeamRequest(updatedTeamObj.id, updatedTeamObj));
            expect(updatedTeam.publicTeam.equals(res.body)).toBeTrue();

            // Confirm db was actually updated:
            const getOneTeam = await request(app).get(`/teams/${updatedTeamObj.id}`).expect(200);
            expect(updatedTeam.publicTeam.equals(getOneTeam.body)).toBeTrue();
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const teamObj = {...updatedTeamObj, id: 1, blah: "wassup"};
            await adminLoggedIn( putTeamRequest(teamObj.id, teamObj, 400));

            // Confirm db was not updated:
            const getOneTeam = await request(app).get(`/teams/${teamObj.id}`).expect(200);
            expect(updatedTeam.publicTeam.equals(getOneTeam.body)).toBeTrue();
            expect(getOneTeam.body.blah).toBeUndefined();
        });
        it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await adminLoggedIn(putTeamRequest(999, updatedTeamObj, 404));
        });
        it("should throw a 403 Forbidden error if a non-admin tries to update a team", async () => {
            await ownerLoggedIn(putTeamRequest(1, updatedTeamObj, 403));
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await putTeamRequest(1, updatedTeamObj, 403)(request(app));
        });
    });

    describe("PATCH /teams/:id (edit a team's owners)", () => {
        const patchTeamRequest = (id: number, ownersToAdd: User[], ownersToRemove: User[], status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePatchRequest(agent, `/teams/${id}`, {add: ownersToAdd, remove: ownersToRemove}, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated team with added owners", async () => {
            const res = await adminLoggedIn(patchTeamRequest(1, [otherUser, adminUser], []));
            const testTeamUpdated = new Team({...testTeamObj, name: updatedName, owners: [otherUser, adminUser]});
            expect(res.body.owners).toBeArrayOfSize(2);
            expect(res.body.owners.filter((owner: User) => owner.id === adminUser.id || owner.id === otherUser.id))
                .toBeArrayOfSize(2);
            expect(testTeamUpdated.publicTeam.equals(new Team(res.body), {hasPassword: true})).toBeTrue();
        });
        it("should allow adding and removing at the same time", async () => {
            const res = await adminLoggedIn(patchTeamRequest(1, [ownerUser], [otherUser]));
            const testTeamUpdated = new Team({...testTeamObj, name: updatedName, owners: [adminUser, ownerUser]});
            expect(res.body.owners).toBeArrayOfSize(2);
            // Checking if admin user is here:
            expect(res.body.owners.filter((owner: User) => owner.id === otherUser.id)).toBeEmpty();
            // Checking if new owner user and other user are here:
            expect(res.body.owners.filter((owner: User) => owner.id === adminUser.id || owner.id === ownerUser.id))
                .toBeArrayOfSize(2);
            expect(testTeamUpdated.publicTeam.equals(new Team(res.body), {hasPassword: true})).toBeTrue();
        });
        it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await adminLoggedIn(patchTeamRequest(999, [otherUser], [], 404));
        });
        it("should throw a 403 Forbidden error if a non-admin tries to update a team's owners", async () => {
            await ownerLoggedIn(patchTeamRequest(1, [otherUser], [], 403));
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await patchTeamRequest(1, [otherUser], [], 403)(request(app));
        });
    });

    describe("DELETE /teams/:id (delete one team)", () => {
        const deleteTeamRequest = (id: number, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/teams/${id}`, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const res = await adminLoggedIn(deleteTeamRequest(1));
            expect(res.body).toEqual({ deleteResult: true, id: 1 });

            // Confirm that it was deleted from the db:
            const getAllRes = await request(app).get("/teams").expect(200);
            expect(getAllRes.body).toBeArrayOfSize(1);

            // Confirm that users that were previously owners of this team have their TeamID set to none
            // lo
        });
        it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await adminLoggedIn(deleteTeamRequest(1, 404));
        });
        it("should throw a 403 Forbidden error if a non-admin tries to delete a team", async () => {
            await ownerLoggedIn(deleteTeamRequest(2, 403));
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await deleteTeamRequest(2, 403)(request(app));
        });
    });
});
