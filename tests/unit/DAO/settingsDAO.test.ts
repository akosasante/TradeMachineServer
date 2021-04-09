import { Repository } from "typeorm";
import SettingsDAO from "../../../src/DAO/SettingsDAO";
import Settings from "../../../src/models/settings";
import { SettingsFactory } from "../../factories/SettingsFactory";
import { MockObj } from "./daoHelpers";
import logger from "../../../src/bootstrap/logger";

describe("SettingsDAO", () => {
    const mockSettingsDb: MockObj = {
        find: jest.fn(),
        findOne: jest.fn(),
        findOneOrFail: jest.fn(),
        insert: jest.fn(),
    };

    const testSettings = SettingsFactory.getSettingsObject(undefined, { tradeWindowStart: SettingsFactory.DEFAULT_WINDOW_START, tradeWindowEnd: SettingsFactory.DEFAULT_WINDOW_END});
    const settingsDAO = new SettingsDAO(mockSettingsDb as unknown as Repository<Settings>);

    afterEach(() => {
        Object.values(mockSettingsDb).forEach(mockFn => mockFn.mockReset());
    });

    beforeAll(() => {
        logger.debug("~~~~~~SETTINGS DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~SETTINGS DAO TESTS COMPLETE~~~~~~");
    });

    it("getAllSettings - should call the db find method", async () => {
        mockSettingsDb.find.mockResolvedValueOnce([testSettings]);
        const defaultOpts = {order: {dateCreated: "DESC"}};
        const res = await settingsDAO.getAllSettings();

        expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testSettings]);
    });

    it("getMostRecentSettings - should call the db findOne method", async () => {
        mockSettingsDb.findOne.mockResolvedValueOnce(testSettings);
        const defaultOpts = {order: {dateCreated: "DESC"}};
        const res = await settingsDAO.getMostRecentSettings();

        expect(mockSettingsDb.findOne).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.findOne).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual(testSettings);
    });

    it("getSettingsById - should call the db findOneOrFail method", async () => {
        mockSettingsDb.findOneOrFail.mockResolvedValueOnce(testSettings);
        const res = await settingsDAO.getSettingsById(testSettings.id!);

        expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledWith(testSettings.id);
        expect(res).toEqual(testSettings);
    });

    it("insertNewSettings - should first get most recent settings and then insert and return the new value", async () => {
        mockSettingsDb.findOne.mockResolvedValueOnce(testSettings);
        mockSettingsDb.insert.mockResolvedValueOnce({identifiers: [{id: testSettings.id!}], generatedMaps: [], raw: []});

        const newSettings = SettingsFactory.getSettings(undefined, undefined, {scheduled: [{downtimeStartDate: SettingsFactory.DEFAULT_DOWNTIME_START, downtimeEndDate: SettingsFactory.DEFAULT_DOWNTIME_END, downtimeReason: SettingsFactory.DEFAULT_DOWNTIME_REASON}]});
        const expectedSettings = {...testSettings, ...newSettings};
        mockSettingsDb.findOneOrFail.mockResolvedValueOnce(expectedSettings);
        const res = await settingsDAO.insertNewSettings(newSettings);

        expect(mockSettingsDb.findOne).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.insert).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.insert).toHaveBeenCalledWith({...expectedSettings, id: newSettings.id, dateCreated: undefined, dateModified: undefined});
        expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledWith({id: testSettings.id!});
        expect(res).toEqual(expectedSettings);
    });
});
