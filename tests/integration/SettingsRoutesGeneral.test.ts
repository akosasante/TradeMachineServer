import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import GeneralSettings from "../../src/models/generalSettings";
import User from "../../src/models/user";
import server from "../../src/server";
import { SettingsFactory } from "../factories/SettingsFactory";
import {
    adminLoggedIn,
    doLogout,
    makeGetRequest,
    makePostRequest,
    ownerLoggedIn,
    setupOwnerAndAdminUsers
} from "./helpers";

let app: Server;
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
    logger.debug("~~~~~~GENERAL SETTINGS ROUTES BEFORE ALL~~~~~~");
    app = await server;
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
});

afterAll(async () => {
    logger.debug("~~~~~~GENERAL SETTINGS ROUTES AFTER ALL~~~~~~");
    await shutdown();
    app.close(() => {
        logger.debug("CLOSED SERVER");
    });
});

describe("Settings API endpoints for general settings", () => {
    const deadline = SettingsFactory.getTradeDailyDeadline();
    const testSettings = new GeneralSettings({deadline});
    let testSettings2: GeneralSettings;

    describe("POST /settings/general (insert new general settings line)", () => {
        const postRequest = (generalSettingsObj: Partial<GeneralSettings>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<GeneralSettings>>(agent, "/settings/general", generalSettingsObj, status);

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single general settings object", async () => {
            const res = await adminLoggedIn(postRequest(testSettings.parse()), app);
            expect(testSettings.equals(new GeneralSettings(res.body))).toBeTrue();
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const deadline2 = SettingsFactory.getTradeDailyDeadlineOff();
            const settingsObj = {deadline: deadline2, blah: "bloop", modifiedBy: adminUser };
            testSettings2 = new GeneralSettings(settingsObj);
            const res = await adminLoggedIn(postRequest(testSettings2), app);

            expect(testSettings2.equals(new GeneralSettings(res.body))).toBeTrue();
            expect(res.body.blah).toBeUndefined();
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a setting", async () => {
            await ownerLoggedIn(postRequest(testSettings.parse(), 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest(testSettings.parse(), 403)(request(app));
        });
    });

    describe("GET /settings/general (get all general settings)", () => {
        const getAllRequest = (status: number = 200) => makeGetRequest(request(app), "/settings/general", status);

        it("should return an array of all general settings in the db", async () => {
            const res = await getAllRequest();
            expect(res.body).toBeArrayOfSize(2);
            expect(testSettings.equals(new GeneralSettings(res.body[1]))).toBeTrue();
        });
    });

    describe("GET /settings/general/recent (get most recent general settings line)", () => {
        const getOneRequest = (status: number = 200) =>
            makeGetRequest(request(app), "/settings/general/recent", status);

        it("should return the most recently entered general settings line", async () => {
            const res = await getOneRequest();
            expect(testSettings2.equals(new GeneralSettings(res.body))).toBeTrue();
        });
    });

    describe("GET /settings/general/:id (get one settings linen by id)", () => {
        const getOneRequest = (id: number, status: number = 200) =>
            makeGetRequest(request(app), `/settings/general/${id}`, status);

        it("should return a single settings line for the given id", async () => {
            const res = await getOneRequest(1);
            expect(testSettings.equals(new GeneralSettings(res.body))).toBeTrue();
        });
        it("should throw a 404 Not Found error if there is no settings line with that id", async () => {
            await getOneRequest(999, 404);
        });
    });
});
