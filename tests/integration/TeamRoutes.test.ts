import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { inspect } from "util";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import Team from "../../src/models/team";
import { Role } from "../../src/models/user";
import server from "../../src/server";
import {
    doLogout, makeDeleteRequest, makeGetRequest,
    makeLoggedInRequest, makePostRequest, makePutRequest
} from "./helpers";

describe("Team API endpoints", () => {
    let app: Server;
    const adminUserObj = { email: "admin@example.com", password: "lol", name: "Cam", roles: [Role.ADMIN]};
    const ownerUserObj = { email: "owner@example.com", password: "lol", name: "Jatheesh", roles: [Role.OWNER]};
    const testTeamObj = {name: "Squirtle Squad", espnId: 1};
    const testTeam = new Team({name: "Squirtle Squad", espnId: 1});

    beforeAll(async () => {
        app = await server;

        // Create admin and owner users in db for rest of this suite's use
        await request(app)
            .post("/users")
            .send(adminUserObj)
            .expect(200);
        await request(app)
            .post("/users")
            .send(ownerUserObj)
            .expect(200);
    });
    afterAll(async () => {
        await redisClient.quit();
    });

    describe("POST /teams (create new team)", () => {
        const expectQueryFailedErrorString = expect.stringMatching(/QueryFailedError/);
        const postRequest = (teamObj: Partial<Team>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Team>>(agent, "/teams", teamObj, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single team object based on the object passed in", async () => {
            const res = await makeLoggedInRequest(
                request.agent(app), adminUserObj.email,
                adminUserObj.password, postRequest(testTeamObj)
            );
            expect(testTeam.publicTeam.equals(res.body)).toBeTrue();
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const teamObj = {...testTeamObj, espnId: 2, blah: "Hello", bloop: "yeeah"};
            const testTeam2 = new Team(teamObj);
            const res = await makeLoggedInRequest(
                request.agent(app), adminUserObj.email,
                adminUserObj.password, postRequest(teamObj)
            );
            expect(testTeam2.publicTeam.equals(res.body)).toBeTrue();
            expect(res.body.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const teamObj = { espnId: 1 };
            const res = await makeLoggedInRequest(
                request.agent(app), adminUserObj.email,
                adminUserObj.password, postRequest(teamObj, 400)
            );
            expect(res.body.stack).toEqual(expectQueryFailedErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a team", async () => {
            await makeLoggedInRequest(
                request.agent(app), ownerUserObj.email,
                ownerUserObj.password, postRequest(testTeamObj, 403)
            );
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await makeLoggedInRequest(
                request(app), adminUserObj.email,
                adminUserObj.password, postRequest(testTeamObj, 403)
            );
        });
    });

    describe("GET /teams (get all teams)", () => {
        const getAllRequest = (status: number = 200) => makeGetRequest(request(app), "/teams", status);
        it("should return an array of all teams (public vers.) in the db", async () => {
            const res = await getAllRequest();
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

    describe("UPDATE /teams/:id (update one team)", () => {
        const putTeamRequest = (id: number, teamObj: Partial<Team>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<Team>>(agent, `/teams/${id}`, teamObj, status);
        const updatedTeamObj = {...testTeamObj, id: 1, name: "Hello darkness my old friend"};
        const updatedTeam = new Team(updatedTeamObj);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });
        it("should return the updated team (public vers.)", async () => {
            const res = await makeLoggedInRequest(
                request.agent(app), adminUserObj.email,
                adminUserObj.password, putTeamRequest(updatedTeamObj.id, updatedTeamObj)
            );
            expect(updatedTeam.publicTeam.equals(res.body)).toBeTrue();

            // Confirm db was actually updated:
            const getOneTeam = await request(app).get(`/teams/${updatedTeamObj.id}`).expect(200);
            expect(updatedTeam.publicTeam.equals(getOneTeam.body)).toBeTrue();
        });
        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const teamObj = {...updatedTeamObj, id: 1, blah: "wassup"};
            await makeLoggedInRequest(
                request.agent(app), adminUserObj.email, adminUserObj.password, putTeamRequest(teamObj.id, teamObj, 400)
            );

            // Confirm db was not updated:
            const getOneTeam = await request(app).get(`/teams/${teamObj.id}`).expect(200);
            expect(updatedTeam.publicTeam.equals(getOneTeam.body)).toBeTrue();
            expect(getOneTeam.body.blah).toBeUndefined();
        });
        it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await makeLoggedInRequest(
                request.agent(app), adminUserObj.email, adminUserObj.password, putTeamRequest(999, updatedTeamObj, 404)
            );
        });
        it("should throw a 403 Forbidden error if a non-admin tries to update a team", async () => {
            await makeLoggedInRequest(
                request.agent(app), ownerUserObj.email, ownerUserObj.password, putTeamRequest(1, updatedTeamObj, 403)
            );
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await makeLoggedInRequest(
                request(app), adminUserObj.email, adminUserObj.password, putTeamRequest(1, updatedTeamObj, 403)
            );
        });
    });

    describe("DELETE /teams/:id (delete one team)", () => {
        const deleteTeamRequest = (id: number, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/teams/${id}`, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });
        it("should return a delete result if successful", async () => {
            const res = await makeLoggedInRequest(
                request.agent(app), adminUserObj.email, adminUserObj.password, deleteTeamRequest(1)
            );
            logger.debug(inspect(res));
        });
        it("should throw a 404 Not Found error if there is no team with that ID", async () => {
            await makeLoggedInRequest(
                request.agent(app), adminUserObj.email, adminUserObj.password, deleteTeamRequest(1, 404)
            );
        });
        it("should throw a 403 Forbidden error if a non-admin tries to delete a team", async () => {
            await makeLoggedInRequest(
                request.agent(app), ownerUserObj.email, ownerUserObj.password, deleteTeamRequest(2, 403)
            );
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await makeLoggedInRequest(
                request(app), adminUserObj.email, adminUserObj.password, deleteTeamRequest(2, 403)
            );
        });
    });
});
