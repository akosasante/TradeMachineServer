import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import UserDAO from "../../src/DAO/UserDAO";
import ScheduledDowntime from "../../src/models/scheduledDowntime";
import User, { Role } from "../../src/models/user";
import server from "../../src/server";
import {
    doLogout,
    makeDeleteRequest,
    makeGetRequest,
    makeLoggedInRequest,
    makePostRequest,
    makePutRequest
} from "./helpers";

let app: Server;
let adminLoggedIn: (fn: (ag: request.SuperTest<request.Test>) => any) => Promise<any>;
let ownerLoggedIn: (fn: (ag: request.SuperTest<request.Test>) => any) => Promise<any>;

beforeAll(async () => {
    app = await server;
    let adminUser: User;
    let ownerUser: User;

    const userDAO = new UserDAO();
    const testPassword = "lol";
    adminUser = await userDAO.createUser({
        email: "admin@example.com", password: testPassword, name: "Cam", roles: [Role.ADMIN],
    });
    ownerUser = await userDAO.createUser({
        email: "owner@example.com", password: testPassword, name: "Jatheesh", roles: [Role.OWNER],
    });
    adminLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), adminUser.email!, testPassword, requestFn);
    ownerLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), ownerUser.email!, testPassword, requestFn);
});

afterAll(async () => {
    await redisClient.quit();
});

describe("Settings API endpoints", () => {
    const previousSchedule = new ScheduledDowntime({
        startTime: new Date("01-01-2018"), endTime: new Date("01-01-2019"),
    });
    const currentSchedule = new ScheduledDowntime({
        startTime: new Date("04-01-2018"), endTime: new Date("01-01-2099"),
    });
    const futureSchedule = new ScheduledDowntime({
        startTime: new Date("01-01-2050"), endTime: new Date("01-01-2080"),
    });

    describe("POST /settings/downtime (create new scheduled downtime)", () => {
        const postRequest = (downtimeObj: Partial<ScheduledDowntime>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<ScheduledDowntime>>(agent, "/settings/downtime", downtimeObj, status);
        afterAll(async () => {
            await adminLoggedIn(postRequest(futureSchedule.parse()));
            await adminLoggedIn(postRequest(currentSchedule.parse()));
        });
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single schedule object based on the object passed in", async () => {
            const res = await adminLoggedIn(postRequest(previousSchedule.parse()));
            expect(previousSchedule.equals(new ScheduledDowntime(res.body))).toBeTrue();
        });

        it("should ignore any invalid properties from the object passed in", async () => {
            const scheduledObj = { ...previousSchedule.parse(), reason: "because", blah: "bloop" };
            const testObj = new ScheduledDowntime(scheduledObj);
            const res = await adminLoggedIn(postRequest(testObj));

            expect(testObj.equals(new ScheduledDowntime(res.body))).toBeTrue();
            expect(res.body.blah).toBeUndefined();
        });

        it("should return a 400 Bad Request error if missing a required property", async () => {
            const testObj = { reason: "becuz" };
            const res = await adminLoggedIn(postRequest(testObj, 400));
            expect(res.body.stack).toEqual(expect.stringMatching(/QueryFailedError/));
        });

        it("should return a 403 Forbidden error if a non-admin tries to create a schedule", async () => {
            await ownerLoggedIn(postRequest(previousSchedule.parse(), 403));
        });

        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest(previousSchedule.parse(), 403)(request(app));
        });
    });

    describe("GET /settings/downtime (get all scheduled downtimes)", () => {
        const getQueryString = (query?: string) => query ? `?option=${query}` : "";
        const getAllRequest = (query: string, status: number = 200) =>
            makeGetRequest(request(app), `/settings/downtime${getQueryString(query)}`, status);

        it("should return an array of all scheduled downtimes in the db in order of start time", async () => {
            const res = await getAllRequest("");
            expect(res.body).toBeArrayOfSize(4);
            expect(previousSchedule.equals(new ScheduledDowntime(res.body[0]))).toBeTrue();
        });

        it("should return an array of all scheduled downtimes with end dates before today's date", async () => {
            const res = await getAllRequest("previous");
            expect(res.body).toBeArrayOfSize(2);
            expect(previousSchedule.equals(new ScheduledDowntime(res.body[0]))).toBeTrue();
        });

        it("should return an array of all scheduled downtimes with start dates after today's date", async () => {
            const res = await getAllRequest("future");
            expect(res.body).toBeArrayOfSize(1);
            expect(futureSchedule.equals(new ScheduledDowntime(res.body[0]))).toBeTrue();
        });
    });

    describe("GET /settings/downtime/current (get current downtime schedule)", () => {
        const getOneRequest = (status: number = 200) =>
            makeGetRequest(request(app), "/settings/downtime/current", status);

        it("should return a single downtime schedule if which started before now and ends after now", async () => {
            const res = await getOneRequest();
            expect(currentSchedule.equals(new ScheduledDowntime(res.body))).toBeTrue();
        });
    });

    describe("GET /settings/downtime/:id (get one schedule by id)", () => {
        const getOneRequest = (id: number, status: number = 200) =>
            makeGetRequest(request(app), `/settings/downtime/${id}`, status);

        it("should return a single schedule for the given id", async () => {
            const res = await getOneRequest(1);
            expect(previousSchedule.equals(new ScheduledDowntime(res.body))).toBeTrue();
        });

        it("should throw a 404 Not Found error if there is no schedule with that id", async () => {
            await getOneRequest(999, 404);
        });
    });

    describe("UPDATE /settings/downtime/:id (update one schedule)", () => {
        const putScheduleRequest = (id: number, scheduleObj: Partial<ScheduledDowntime>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<ScheduledDowntime>>(agent, `/settings/downtime/${id}`, scheduleObj, status);
        const updatedSchedule = new ScheduledDowntime({ ...previousSchedule.parse(), reason: "hoobastank"});
        const ID = 1;
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated schedule", async () => {
            const res = await adminLoggedIn(putScheduleRequest(ID, updatedSchedule.parse()));
            expect(updatedSchedule.equals(new ScheduledDowntime(res.body))).toBeTrue();

            // Confirm db was actually updated:
            const getOneSchedule = await request(app).get(`/settings/downtime/${ID}`).expect(200);
            expect(updatedSchedule.equals(new ScheduledDowntime(getOneSchedule.body))).toBeTrue();
        });

        it("should throw a 400 Bad Request if any invalid properties are passed", async () => {
            const invalidPropsScheduleObj = { ...updatedSchedule.parse(), blah: "wassup" };
            await adminLoggedIn(putScheduleRequest(ID, invalidPropsScheduleObj, 400));

            // Confirm db was not updated:
            const getOneSchedule = await request(app).get(`/settings/downtime/${ID}`).expect(200);
            expect(updatedSchedule.equals(new ScheduledDowntime(getOneSchedule.body))).toBeTrue();
            expect(getOneSchedule.body.blah).toBeUndefined();
        });

        it("should throw a 404 Not Found error if there is no schedule with that ID", async () => {
            await adminLoggedIn(putScheduleRequest(999, updatedSchedule.parse(), 404));
        });

        it("should throw a 403 Forbidden error if a non-admin tries to update a schedule", async () => {
            await ownerLoggedIn(putScheduleRequest(ID, updatedSchedule.parse(), 403));
        });

        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await putScheduleRequest(ID, updatedSchedule.parse(), 403)(request(app));
        });
    });

    describe("DELETE /settings/downtime/:id (delete one schedule)", () => {
        const deleteScheduleRequest = (id: number, status: number = 200) => (agent: request.SuperTest<request.Test>) =>
            makeDeleteRequest(agent, `/settings/downtime/${id}`, status);
        const ID = 4;

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const res = await adminLoggedIn(deleteScheduleRequest(ID));
            expect(res.body).toEqual({ deleteResult: true, id: ID });

            // Confirm that it was deleted from the db:
            const getAllFuture = await request(app).get("/settings/downtime?option=future").expect(200);
            expect(getAllFuture.body).toBeArrayOfSize(0);
        });

        it("should throw a 404 Not Found error if there is no schedule with that ID", async () => {
            await adminLoggedIn(deleteScheduleRequest(ID, 404));
        });

        it("should throw a 403 Forbidden error if a non-admin tries to delete a schedule", async () => {
            await ownerLoggedIn(deleteScheduleRequest(1, 403));
        });

        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await deleteScheduleRequest(1, 403)(request(app));
        });
    });
});
