import "jest";
import "jest-extended";
import { clone } from "lodash";
import GeneralSettings from "../../../src/models/generalSettings";
import { SettingsFactory } from "../../factories/SettingsFactory";
import { UserFactory } from "../../factories/UserFactory";

describe("GeneralSettings Class", () => {
    const deadline = SettingsFactory.getTradeDailyDeadline();
    const settingsObj = {deadline};
    const generalSettings = new GeneralSettings(settingsObj);

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(generalSettings.id).not.toBeDefined();
            expect(generalSettings.modifiedBy).toBeUndefined();
            expect(generalSettings.deadline).toEqual(deadline);
        });
    });

    describe("instance methods", () => {
        it("toString/0", () => {
            // tslint:disable-next-line:max-line-length
            const pattern = new RegExp(`General Settings: Deadline Status: ${generalSettings.deadline.status}`);
            expect(generalSettings.toString()).toMatch(pattern);
        });

        describe("equals/2", () => {
            const deadline2 = SettingsFactory.getTradeDailyDeadlineOff();
            const modifiedBy = UserFactory.getUser();
            const settingsCopy = clone(generalSettings);
            const settings2 = new GeneralSettings({deadline: deadline2});
            const settings3 = new GeneralSettings({deadline: deadline2, modifiedBy});

            it("should return true if the two instances are identical. Excludes = default", () => {
                expect(generalSettings.equals(settingsCopy)).toBeTrue();
            });
            it("should return true if the two are identical considering the excludes", () => {
                expect(settings2.equals(settings3, {modifiedBy: true})).toBeTrue();
            });
            it("should throw a useful error if something doesn't match (complex fields)", () => {
                expect(() => generalSettings.equals(settings2)).toThrowWithMessage(Error, "Not matching: deadline");
            });
            it("should throw a useful error if something doesn't match (model fields)", () => {
                expect(() => settings2.equals(settings3)).toThrowWithMessage(Error, "Not matching: modifiedBy");
            });
        });
    });
});
