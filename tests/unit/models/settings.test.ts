import "jest";
import "jest-extended";
import Settings from "../../../src/models/settings";
import { SettingsFactory } from "../../factories/SettingsFactory";
import logger from "../../../src/bootstrap/logger";

describe("GeneralSettings Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~SETTINGS TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~SETTINGS TESTS COMPLETE~~~~~~");
    });

    const settingsObj = SettingsFactory.getSettingsObject(undefined, {tradeWindowStart: SettingsFactory.DEFAULT_WINDOW_START, tradeWindowEnd: SettingsFactory.DEFAULT_WINDOW_END});
    const settings = new Settings(settingsObj);

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(settings.modifiedBy).toBeDefined();
            expect(settings.tradeWindowStart).toBeDate();
            expect(settings.tradeWindowEnd).toBeDate();
            expect(settings.downtimeStartDate).toBeUndefined();
            expect(settings.downtimeEndDate).toBeUndefined();
            expect(settings.downtimeReason).toBeUndefined();
            expect(settings).toBeInstanceOf(Settings);
            expect(settingsObj).not.toBeInstanceOf(Settings);
        });
    });

    describe("instance methods", () => {
        it("toString/0 - should return a string with the UUID", () => {
            expect(settings.toString()).toMatch(settings.id!);
            expect(settings.toString()).toMatch("Settings#");
        });

        it("parse/1 - should take a setting and return a POJO", () => {
            expect(settings).toBeInstanceOf(Settings);
            expect(settings.parse()).not.toBeInstanceOf(Settings);
            expect(settings.parse()).toEqual(settingsObj);
            expect(settings.parse()).toEqual(expect.any(Object));
        });
    });
});
