import "jest";
import "jest-extended";
import { clone } from "lodash";
import GeneralSettings, { TradeDeadlineStatus } from "../../../src/models/generalSettings";
import User, { Role } from "../../../src/models/user";

describe("GeneralSettings Class", () => {
    const startDate = new Date("January 1 2019 1:00PM");
    const endDate = new Date("January 1 2019 5:00PM");
    const deadline = {status: TradeDeadlineStatus.ON, startTime: startDate, endTime: endDate};
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
            expect(generalSettings.toString()).toMatch(generalSettings.deadline.status);
            expect(generalSettings.toString()).not.toMatch("Last changed by");
            expect(generalSettings.toString()).toMatch("General Settings: Deadline Status");
        });

        describe("equals/2", () => {
            const deadline2 = {status: TradeDeadlineStatus.OFF, startTime: startDate, endTime: endDate};
            const modifiedBy = new User({email: "test@example.com", password: "lol", roles: [Role.ADMIN]});
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
