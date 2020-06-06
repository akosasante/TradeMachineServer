import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import Settings from "../../src/models/settings";
import User from "../../src/models/user";
import { SettingsFactory } from "../factories/SettingsFactory";
import { adminLoggedIn, doLogout, makeGetRequest,
    makePostRequest, ownerLoggedIn, setupOwnerAndAdminUsers } from "./helpers";
import startServer from "../../src/bootstrap/app";
import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
import { inspect } from "util";

dotenvConfig({path: resolvePath(__dirname, "../.env")});

let app: Server;
let adminUser: User;
let ownerUser: User;
let testSettings: Settings;
let testSettings2: Settings;
let expectedTestSettings: object;
let expectedTestSettings2: object;

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
    logger.debug("~~~~~~SETTINGS ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
    testSettings = SettingsFactory.getSettings(ownerUser, {tradeWindowStart: SettingsFactory.DEFAULT_WINDOW_START, tradeWindowEnd: SettingsFactory.DEFAULT_WINDOW_END});
    testSettings2 = SettingsFactory.getSettings(adminUser, undefined, {downtimeStartDate: SettingsFactory.DEFAULT_DOWNTIME_START, downtimeEndDate: SettingsFactory.DEFAULT_DOWNTIME_END, downtimeReason: SettingsFactory.DEFAULT_DOWNTIME_REASON});

    expectedTestSettings = {
        id: testSettings.id,
        modifiedBy: expect.toBeObject(),
        tradeWindowStart: testSettings.tradeWindowStart,
        tradeWindowEnd: testSettings.tradeWindowEnd,
        // tslint:disable-next-line:no-null-keyword
        downtimeReason: null,
    };

    expectedTestSettings2 = {
        id: testSettings2.id,
        modifiedBy: expect.toBeObject(),
        downtimeStartDate: testSettings2.downtimeStartDate?.toISOString(),
        downtimeEndDate: testSettings2.downtimeEndDate?.toISOString(),
        downtimeReason: testSettings2.downtimeReason,
        tradeWindowStart: testSettings.tradeWindowStart,
        tradeWindowEnd: testSettings.tradeWindowEnd,
    };
});

afterAll(async () => {
    logger.debug("~~~~~~SETTINGS ROUTES AFTER ALL~~~~~~");
    await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
});

describe("Settings API endpoints for general settings", () => {
    describe("POST /settings (insert new settings line)", () => {
        const expectErrorString = expect.stringMatching(/Modifying user must be provided/);
        const postRequest = (settingsObj: Partial<Settings>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Settings>>(agent, "/settings", settingsObj, status);
        const getOneRequest = (id: string, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makeGetRequest(agent, `/settings/${id}`, status);

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single settings object based on the object passed in", async () => {
            const {body} = await adminLoggedIn(postRequest(testSettings.parse()), app);
            expect(body).toMatchObject(expectedTestSettings);
        });
        it("should ignore any invalid properties from the object passed in and include values from previous settings", async () => {
            const {body: createBody} = await adminLoggedIn(postRequest({...testSettings2, blah: "bloop"} as Partial<Settings>), app);
            const {body} = await adminLoggedIn(getOneRequest(createBody.id), app);

            expect(body).toMatchObject(expectedTestSettings2);
            expect(body.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const {body} = await adminLoggedIn(postRequest({tradeWindowStart: SettingsFactory.DEFAULT_WINDOW_START, tradeWindowEnd: SettingsFactory.DEFAULT_WINDOW_END}, 400), app);
            logger.debug(inspect(body));
            expect(body.message).toEqual(expectErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a setting", async () => {
            await ownerLoggedIn(postRequest(testSettings.parse(), 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest(testSettings.parse(), 403)(request(app));
        });
    });

    describe("GET /settings (get all settings lines)", () => {
        const getAllRequest = (status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeGetRequest(agent, "/settings", status);

        it("should return an array of all settings in the db", async () => {
            const {body} = await adminLoggedIn(getAllRequest(), app);
            expect(body).toBeArrayOfSize(2);
            const returnedSetting = body.find((setting: Settings) => setting.id === testSettings.id);
            expect(returnedSetting).toMatchObject(expectedTestSettings);
        });

        it("should return a 403 Forbidden error if a non-admin tries to create a setting", async () => {
            await ownerLoggedIn(getAllRequest(403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await getAllRequest(403)(request(app));
        });
    });

    describe("GET /settings/current (get most recent settings line)", () => {
        const getRecentRequest = (status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeGetRequest(agent, "/settings/current", status);


        it("should return the most recently inserted settings line", async () => {
            const {body} = await adminLoggedIn(getRecentRequest(), app);
            expect(body).toMatchObject(expectedTestSettings2);
        });

        it("should return a 403 Forbidden error if a non-admin tries to create a setting", async () => {
            await ownerLoggedIn(getRecentRequest(403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await getRecentRequest(403)(request(app));
        });
    });

    describe("GET /settings/:id (get settings line by ID)", () => {
        const getOneRequest = (id: string, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeGetRequest(agent, `/settings/${id}`, status);


        it("should return the most recently inserted settings line", async () => {
            const {body} = await adminLoggedIn(getOneRequest(testSettings.id!), app);
            expect(body).toMatchObject(expectedTestSettings);
        });

        it("should return a 403 Forbidden error if a non-admin tries to create a setting", async () => {
            await ownerLoggedIn(getOneRequest(testSettings.id!, 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await getOneRequest(testSettings.id!, 403)(request(app));
        });
    });
});
