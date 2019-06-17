import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { inspect } from "util";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import UserDAO from "../../src/DAO/UserDAO";
import GeneralSettings, { TradeDeadlineStatus } from "../../src/models/generalSettings";
import User, { Role } from "../../src/models/user";
import server from "../../src/server";
import { doLogout, makeGetRequest, makeLoggedInRequest, makePostRequest } from "./helpers";

let app: Server;
let adminLoggedIn: (fn: (ag: request.SuperTest<request.Test>) => any) => Promise<any>;
let ownerLoggedIn: (fn: (ag: request.SuperTest<request.Test>) => any) => Promise<any>;
let adminUser: User;
let ownerUser: User;

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
    await shutdown();
});

describe("Settings API endpoints for general settings", () => {
    const startDate = new Date("January 1 2019 1:00");
    const endDate = new Date("January 1 2019 5:00");
    const deadline = {status: TradeDeadlineStatus.ON, startTime: startDate, endTime: endDate};
    const testSettings = new GeneralSettings({deadline});

    describe("POST /settings/general (insert new general settings line)", () => {
        const postRequest = (generalSettingsObj: Partial<GeneralSettings>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<GeneralSettings>>(agent, "/settings/general", generalSettingsObj, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single general settings object", async () => {
            const res = await adminLoggedIn(postRequest(testSettings.parse()));
            expect(testSettings.equals(new GeneralSettings(res.body))).toBeTrue();
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const settingsObj = {...testSettings.parse(), blah: "bloop",
                modifiedBy: adminUser };
            const testSettings2 = new GeneralSettings(settingsObj);
            logger.debug(inspect(testSettings2));
            const res = await adminLoggedIn(postRequest(testSettings2));

            expect(testSettings2.equals(new GeneralSettings(res.body))).toBeTrue();
            expect(res.body.blah).toBeUndefined();
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a setting", async () => {
            await ownerLoggedIn(postRequest(testSettings.parse(), 403));
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest(testSettings.parse(), 403)(request(app));
        });
    });

    describe("GET /settings/general (get all general settings)", () => {
        const getAllRequest = (status: number = 200) => makeGetRequest(request(app), "/settings/general", status);

        it("should return an array of all general settings in the db", async () => {
            const res = await getAllRequest();
            logger.debug(inspect(res.body));
            expect(res.body).toBeArrayOfSize(2);
            expect(testSettings.equals(new GeneralSettings(res.body[0]))).toBeTrue();
        });
    });

    // describe("GET /settings/general/recent (get most recent general settings line", () => {
    //     const getOneRequest = (status: number = 200) =>
    //         makeGetRequest(request(app), "/settings/general/recent", status);
    //
    //     it("should return the most rece")
    // })
});
