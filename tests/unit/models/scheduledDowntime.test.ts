import "jest";
import "jest-extended";
import { clone } from "lodash";
import ScheduledDowntime from "../../../src/models/scheduledDowntime";
import User, { Role } from "../../../src/models/user";

describe("ScheduledDowntime Class", () => {
    const startDate = new Date("January 1 2019");
    const endDate = new Date("February 1 2019");
    const downtimeObj = {startTime: startDate, endTime: endDate};
    const scheduledDowntime = new ScheduledDowntime(downtimeObj);

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(scheduledDowntime.startTime).toEqual(startDate);
            expect(scheduledDowntime.endTime).toEqual(endDate);
            expect(scheduledDowntime.id).not.toBeDefined();
            expect(scheduledDowntime.cancelledDate).toBeUndefined();
            expect(scheduledDowntime.reason).toBeUndefined();
            expect(scheduledDowntime.createdBy).toBeUndefined();
            expect(scheduledDowntime.modifiedBy).toBeUndefined();
        });
    });

    describe("instance methods", () => {
        it("toString/0", () => {
            // tslint:disable-next-line:max-line-length
            const pattern = new RegExp(`Downtime from ${scheduledDowntime.startTime.toISOString()} to ${scheduledDowntime.endTime.toISOString()}`);
            expect(scheduledDowntime.toString()).toMatch(pattern);
        });

        describe("equals/2", () => {
            const user1 = new User({email: "test@example.com", password: "lol", roles: [Role.ADMIN]});
            const downtime2 = clone(scheduledDowntime);
            const downtime3NewDate = new ScheduledDowntime({
                startTime: new Date("September 20 2018"), endTime: endDate});
            const downtime4CreatedBy = new ScheduledDowntime({
                startTime: startDate, endTime: endDate, createdBy: user1});
            const downtime5CreatedByAlso = clone(downtime4CreatedBy);

            it("should return true if the two instances are identical. Excludes = default", () => {
                expect(downtime2.equals(scheduledDowntime)).toBeTrue();
                expect(downtime4CreatedBy.equals(downtime5CreatedByAlso)).toBeTrue();
            });

            it("should return true if the two instances are identical considering the excludes", () => {
                expect(scheduledDowntime.equals(downtime4CreatedBy, {createdBy: true})).toBeTrue();
            });

            it("should throw a useful error if something doesn't match (complex fields)", () => {
                expect(() =>
                    scheduledDowntime.equals(downtime3NewDate)).toThrowWithMessage(Error, "Not matching: startTime");
            });

            it("should throw a useful error if something doesn't match (model fields)", () => {
                expect(() =>
                    scheduledDowntime.equals(downtime4CreatedBy)).toThrowWithMessage(Error, "Not matching: createdBy");
            });
        });
    });
});
