import { Server } from "http";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import Settings from "../../src/models/settings";
import User from "../../src/models/user";
import { SettingsFactory } from "../factories/SettingsFactory";
import {
    adminLoggedIn,
    clearDb,
    doLogout,
    makeGetRequest,
    makePostRequest,
    ownerLoggedIn,
    setupOwnerAndAdminUsers
} from "./helpers";
import startServer from "../../src/bootstrap/app";
import { getConnection } from "typeorm";
import SettingsDAO from "../../src/DAO/SettingsDAO";

let app: Server;
let adminUser: User;
let ownerUser: User;
let testSettings: Settings;
let testSettings2: Settings;
let expectedTestSettings: {
  id: any;
  modifiedBy: any;
  tradeWindowStart: string | undefined;
  tradeWindowEnd: string | undefined;
  // tslint:disable-next-line:no-null-keyword
  downtime: null;
};
let expectedTestSettings2: {
  id: any;
  modifiedBy: any;
  downtime: any;
  // tslint:disable-next-line:no-null-keyword
  tradeWindowStart: null;
  // tslint:disable-next-line:no-null-keyword
  tradeWindowEnd: null;
};
let mergedSettings: {
  id: any;
  modifiedBy: any;
  downtime: any;
  tradeWindowStart: string | undefined;
  tradeWindowEnd: string | undefined;
};
let settingsDAO: SettingsDAO;

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
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
    logger.debug("~~~~~~SETTINGS ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    settingsDAO = new SettingsDAO();
    return app;
});

afterAll(async () => {
    logger.debug("~~~~~~SETTINGS ROUTES AFTER ALL~~~~~~");
    const shutdownRedis = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownRedis;
});

describe("Settings API endpoints for general settings", () => {
    beforeEach(async () => {
        [adminUser, ownerUser] = await setupOwnerAndAdminUsers();
        testSettings = SettingsFactory.getSettings(ownerUser, {
            tradeWindowStart: SettingsFactory.DEFAULT_WINDOW_START,
            tradeWindowEnd: SettingsFactory.DEFAULT_WINDOW_END,
        });
        delete testSettings.downtime;
        testSettings2 = SettingsFactory.getSettings(adminUser, undefined, {
            scheduled: [{
                downtimeStartDate: SettingsFactory.DEFAULT_DOWNTIME_START,
                downtimeEndDate: SettingsFactory.DEFAULT_DOWNTIME_END,
                downtimeReason: SettingsFactory.DEFAULT_DOWNTIME_REASON,
            }],
        });
        delete testSettings2.tradeWindowEnd;
        delete testSettings2.tradeWindowStart;

        expectedTestSettings = {
            id: expect.any(String),
            modifiedBy: expect.toBeObject(),
            tradeWindowStart: testSettings.tradeWindowStart,
            tradeWindowEnd: testSettings.tradeWindowEnd,
            // tslint:disable-next-line:no-null-keyword
            downtime: null,
        };

        const expectedDowntimeObj = {
            scheduled: [{
                downtimeStartDate: testSettings2.downtime?.scheduled[0].downtimeStartDate?.toISOString(),
                downtimeEndDate: testSettings2.downtime?.scheduled[0].downtimeEndDate?.toISOString(),
                downtimeReason: testSettings2.downtime?.scheduled[0].downtimeReason,
            }],
        };

        expectedTestSettings2 = {
            id: expect.any(String),
            modifiedBy: expect.toBeObject(),
            downtime: expect.objectContaining(expectedDowntimeObj),
            // tslint:disable-next-line:no-null-keyword
            tradeWindowStart: null,
            // tslint:disable-next-line:no-null-keyword
            tradeWindowEnd: null,
        };

        mergedSettings = {
            id: expect.any(String),
            modifiedBy: expect.toBeObject(),
            downtime: expect.objectContaining(expectedDowntimeObj),
            tradeWindowStart: testSettings.tradeWindowStart,
            tradeWindowEnd: testSettings.tradeWindowEnd,
        };

        return [adminUser, ownerUser];
    });
    afterEach(async () => {
        return await clearDb(getConnection(process.env.NODE_ENV));
    });

    describe("GET /settings (get all settings lines)", () => {
        const getAllRequest = (status = 200) =>
            (agent: request.SuperTest<request.Test>) => makeGetRequest(agent, "/settings", status);

        it("should return an array of all settings in the db", async () => {
            // insert some settings rows
            await settingsDAO.insertNewSettings(testSettings);
            await settingsDAO.insertNewSettings(testSettings2);

            const { body } = await adminLoggedIn(getAllRequest(), app);

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
        const getRecentRequest = (status = 200) =>
            (agent: request.SuperTest<request.Test>) => makeGetRequest(agent, "/settings/current", status);

        it("should return the most recently inserted settings line", async () => {
            // insert some settings rows
            await settingsDAO.insertNewSettings(testSettings);
            await settingsDAO.insertNewSettings(testSettings2);

            const { body } = await adminLoggedIn(getRecentRequest(), app);

            expect(body).toMatchObject(mergedSettings);
        });

        it("should return a 403 Forbidden error if a non-admin tries to create a setting", async () => {
            await ownerLoggedIn(getRecentRequest(403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await getRecentRequest(403)(request(app));
        });
    });

    describe("GET /settings/:id (get settings line by ID)", () => {
        const getOneRequest = (id: string, status = 200) =>
            (agent: request.SuperTest<request.Test>) => makeGetRequest(agent, `/settings/${id}`, status);


        it("should return the settings line with the given id", async () => {
            // insert some settings rows
            await settingsDAO.insertNewSettings(testSettings);
            await settingsDAO.insertNewSettings(testSettings2);

            const { body } = await adminLoggedIn(getOneRequest(testSettings.id!), app);

            expect(body).toMatchObject(expectedTestSettings);
        });

        it("should return a 403 Forbidden error if a non-admin tries to create a setting", async () => {
            await ownerLoggedIn(getOneRequest(testSettings.id!, 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await getOneRequest(testSettings.id!, 403)(request(app));
        });
    });

    describe("POST /settings (insert new settings line)", () => {
        const expectErrorString = expect.stringMatching(/Modifying user must be provided/);
        const postRequest = (settingsObj: Partial<Settings>, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Settings>>(agent, "/settings", settingsObj, status);
        const getOneRequest = (id: string, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makeGetRequest(agent, `/settings/${id}`, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return a single settings object based on the object passed in", async () => {
            const { body } = await adminLoggedIn(postRequest(testSettings.parse()), app);
            expect(body).toMatchObject(expectedTestSettings);
        });
        it("should ignore any invalid properties from the object passed in and include values from previous settings", async () => {
            const { body: createBody } = await adminLoggedIn(postRequest({
                ...testSettings2,
                blah: "bloop",
            } as Partial<Settings>), app);
            const { body } = await adminLoggedIn(getOneRequest(createBody.id), app);

            expect(body).toMatchObject(expectedTestSettings2);
            expect(body.blah).toBeUndefined();
        });
        it("should merge the posted settings object with the most recent one in the database", async () => {
            await settingsDAO.insertNewSettings(testSettings);
            const { body } = await adminLoggedIn(postRequest(testSettings2.parse()), app);

            expect(body).toMatchObject(mergedSettings);
        });
        it("should unset any fields that are passed in with a value of null", async () => {
            await settingsDAO.insertNewSettings(testSettings);
            // @ts-ignore
            // tslint:disable-next-line:no-null-keyword
            const { body } = await adminLoggedIn(postRequest({ ...testSettings2.parse(), tradeWindowEnd: null }), app);

            expect(body.tradeWindowStart).toBeDefined();
            expect(body.tradeWindowEnd).toBeNull();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const { body } = await adminLoggedIn(postRequest({
                tradeWindowStart: SettingsFactory.DEFAULT_WINDOW_START,
                tradeWindowEnd: SettingsFactory.DEFAULT_WINDOW_END,
            }, 400), app);
            expect(body.message).toEqual(expectErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a setting", async () => {
            await ownerLoggedIn(postRequest({ ...testSettings.parse() }, 403), app);
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest(testSettings.parse(), 403)(request(app));
        });
    });
});
/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
