import { Repository } from "typeorm";
import { mockDeep } from "jest-mock-extended";
import SettingsDAO from "../../../src/DAO/SettingsDAO";
import Settings from "../../../src/models/settings";
import { SettingsFactory } from "../../factories/SettingsFactory";
import logger from "../../../src/bootstrap/logger";

describe("SettingsDAO", () => {
    const mockSettingsDb = mockDeep<Repository<Settings>>();

    const testSettings = SettingsFactory.getSettingsObject(undefined, {
        tradeWindowStart: SettingsFactory.DEFAULT_WINDOW_START,
        tradeWindowEnd: SettingsFactory.DEFAULT_WINDOW_END,
    });
    const settingsDAO = new SettingsDAO(mockSettingsDb as any);

    afterEach(() => {
        jest.clearAllMocks();
    });

    beforeAll(() => {
        logger.debug("~~~~~~SETTINGS DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~SETTINGS DAO TESTS COMPLETE~~~~~~");
    });

    it("getAllSettings - should call the db find method", async () => {
        mockSettingsDb.find.mockResolvedValueOnce([testSettings as any]);
        const defaultOpts = { order: { dateCreated: "DESC" } };
        const res = await settingsDAO.getAllSettings();

        expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testSettings]);
    });

    it("getMostRecentSettings - should call the db findOne method", async () => {
        mockSettingsDb.find.mockResolvedValueOnce([testSettings as any]);
        const defaultOpts = { order: { dateCreated: "DESC" }, skip: 0, take: 1 };
        const res = await settingsDAO.getMostRecentSettings();

        expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual(testSettings);
    });

    it("getSettingsById - should call the db findOneOrFail method", async () => {
        mockSettingsDb.findOneOrFail.mockResolvedValueOnce(testSettings as any);
        const res = await settingsDAO.getSettingsById(testSettings.id);

        expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.findOneOrFail).toHaveBeenCalledWith({ where: { id: testSettings.id } });
        expect(res).toEqual(testSettings);
    });

    it("insertNewSettings - should first get most recent settings and then insert and return the new value", async () => {
        mockSettingsDb.find.mockResolvedValueOnce([testSettings as any]);

        const newSettings = SettingsFactory.getSettings(undefined, undefined, {
            scheduled: [
                {
                    downtimeStartDate: SettingsFactory.DEFAULT_DOWNTIME_START,
                    downtimeEndDate: SettingsFactory.DEFAULT_DOWNTIME_END,
                    downtimeReason: SettingsFactory.DEFAULT_DOWNTIME_REASON,
                },
            ],
        });
        const expectedSettings = { ...testSettings, ...newSettings };
        const settingsToCreate = {
            ...expectedSettings,
            id: newSettings.id,
            dateCreated: undefined,
            dateModified: undefined,
        };

        mockSettingsDb.create.mockReturnValue(expectedSettings as any);
        mockSettingsDb.save.mockResolvedValueOnce(expectedSettings as any);
        const res = await settingsDAO.insertNewSettings(newSettings);

        expect(mockSettingsDb.find).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.create).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.create).toHaveBeenCalledWith(settingsToCreate);
        expect(mockSettingsDb.save).toHaveBeenCalledTimes(1);
        expect(mockSettingsDb.save).toHaveBeenCalledWith(expectedSettings);
        expect(res).toEqual(expectedSettings);
    });
});
