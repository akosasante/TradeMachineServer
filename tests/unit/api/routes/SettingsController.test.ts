import "jest";
import "jest-extended";
import SettingsController from "../../../../src/api/routes/SettingsController";
import SettingsDAO from "../../../../src/DAO/SettingsDAO";
import { SettingsFactory } from "../../../factories/SettingsFactory";
import logger from "../../../../src/bootstrap/logger";

describe("SettingsController", () => {
    const mockSettingsDAO = {
        getAllSettings: jest.fn(),
        getMostRecentSettings: jest.fn(),
        getSettingsById: jest.fn(),
        insertNewSettings: jest.fn(),
    };

    const testSettings = SettingsFactory.getSettingsObject(undefined, {tradeWindowStart: SettingsFactory.DEFAULT_WINDOW_START, tradeWindowEnd: SettingsFactory.DEFAULT_WINDOW_END});
    const settingsController = new SettingsController(mockSettingsDAO as unknown as SettingsDAO);

    beforeAll(() => {
        logger.debug("~~~~~~SETTINGS CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~SETTINGS CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        Object.entries(mockSettingsDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

   describe("getAllSettings method", () => {
       it("should return an array of settings", async () => {
           mockSettingsDAO.getAllSettings.mockResolvedValueOnce([testSettings]);
           const res = await settingsController.getAllSettings();

           expect(mockSettingsDAO.getAllSettings).toHaveBeenCalledTimes(1);
           expect(mockSettingsDAO.getAllSettings).toHaveBeenCalledWith();
           expect(res).toEqual([testSettings]);
       });
       it("should bubble up any errors from the DAO", async () => {
           mockSettingsDAO.getAllSettings.mockImplementation(() => {
               throw new Error("Generic Error");
           });
           await expect(settingsController.getAllSettings())
               .rejects.toThrow(Error);
       });
   });

   describe("getCurrentSettings method", () => {
       it("should return the most recent settings line", async () => {
           mockSettingsDAO.getMostRecentSettings.mockResolvedValueOnce(testSettings);
           const res = await settingsController.getCurrentSettings();

           expect(mockSettingsDAO.getMostRecentSettings).toHaveBeenCalledTimes(1);
           expect(mockSettingsDAO.getMostRecentSettings).toHaveBeenCalledWith();
           expect(res).toEqual(testSettings);
       });
   });

   describe("getOneSettingsLine method", () => {
       it("should return a settings line by id", async () => {
           mockSettingsDAO.getSettingsById.mockResolvedValueOnce(testSettings);
           const res = await settingsController.getOneSettingsLine(testSettings.id!);

           expect(mockSettingsDAO.getSettingsById).toHaveBeenCalledTimes(1);
           expect(mockSettingsDAO.getSettingsById).toHaveBeenCalledWith(testSettings.id!);
           expect(res).toEqual(testSettings);
       });
   });

   describe("appendNewSettingsLine method", () => {
       it("should create a new settings line", async () => {
           mockSettingsDAO.insertNewSettings.mockResolvedValueOnce(testSettings);
           const res = await settingsController.appendNewSettingsLine({downtimeReason: "hello"});

           expect(mockSettingsDAO.insertNewSettings).toHaveBeenCalledTimes(1);
           expect(mockSettingsDAO.insertNewSettings).toHaveBeenCalledWith({downtimeReason: "hello"});
           expect(res).toEqual(testSettings);
       });
   });
});
