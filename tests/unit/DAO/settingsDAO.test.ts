import "jest";
import "jest-extended";
import { Repository } from "typeorm";
import SettingsDAO from "../../../src/DAO/SettingsDAO";
import Settings from "../../../src/models/settings";
import { SettingsFactory } from "../../factories/SettingsFactory";
import { MockObj } from "./daoHelpers";
import logger from "../../../src/bootstrap/logger";
import { inspect } from "util";

describe("SettingsDAO", () => {
    const mockSettingsDb: MockObj = {
        find: jest.fn(),
        findOne: jest.fn(),
        findOneOrFail: jest.fn(),
        insert: jest.fn(),
    };

    const testSettings = SettingsFactory.getSettingsObject(undefined, {tradeWindowStart: SettingsFactory.DEFAULT_WINDOW_START, tradeWindowEnd: SettingsFactory.DEFAULT_WINDOW_END});
    const settingsDAO = new SettingsDAO(mockSettingsDb as unknown as Repository<Settings>);

    afterEach(() => {
        Object.keys(mockSettingsDb).forEach((action: string) => {
            (mockSettingsDb[action as keyof MockObj] as jest.Mock).mockClear();
        });
    });

    beforeAll(() => {
        logger.debug("~~~~~~SETTINGS DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~SETTINGS DAO TESTS COMPLETE~~~~~~");
    });

    it("getAllSettings - should call the db find method", async () => {
        mockSettingsDb.find.mockReturnValueOnce([testSettings]);
        const defaultOpts = {order: {dateCreated: "DESC"}};
        const res = await settingsDAO.getAllSettings();

        expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testSettings]);
    });

    it("getMostRecentSettings - should call the db findOne method", async () => {
        mockSettingsDb.findOne.mockReturnValueOnce(testSettings);
        const defaultOpts = {order: {dateCreated: "DESC"}};
        const res = await settingsDAO.getMostRecentSettings();

        expect(mockSettingsDb.findOne).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.findOne).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual(testSettings);
    });

    it("getSettingsById - should call the db findOneOrFail method", async () => {
        mockSettingsDb.findOneOrFail.mockReturnValueOnce(testSettings);
        const res = await settingsDAO.getSettingsById(testSettings.id!);

        expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledWith(testSettings.id);
        expect(res).toEqual(testSettings);
    });

    it("insertNewSettings - should first get most recent settings and then insert and return the new value", async () => {
        mockSettingsDb.findOne.mockReturnValueOnce(testSettings);
        mockSettingsDb.insert.mockReturnValueOnce({identifiers: [{id: testSettings.id!}], generatedMaps: [], raw: []});

        const newSettings = SettingsFactory.getSettings(undefined, undefined, {downtimeStartDate: SettingsFactory.DEFAULT_DOWNTIME_START, downtimeEndDate: SettingsFactory.DEFAULT_DOWNTIME_END, downtimeReason: SettingsFactory.DEFAULT_DOWNTIME_REASON});
        const expectedSettings = {...testSettings, ...newSettings};
        mockSettingsDb.find.mockReturnValueOnce([expectedSettings]);
        const res = await settingsDAO.insertNewSettings(newSettings);
        logger.debug(inspect(testSettings));

        expect(mockSettingsDb.findOne).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.insert).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.insert).toHaveBeenCalledWith({...expectedSettings, id: undefined, dateCreated: undefined, dateModified: undefined});
        expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.find).toHaveBeenCalledWith({id: testSettings.id!});
        expect(res).toEqual(expectedSettings);
    });
});
