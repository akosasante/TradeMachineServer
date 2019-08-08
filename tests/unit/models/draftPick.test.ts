import "jest";
import "jest-extended";
import { clone } from "lodash";
import DraftPick from "../../../src/models/draftPick";
import { LeagueLevel } from "../../../src/models/player";
import User, { Role } from "../../../src/models/user";

describe("DraftPick Class", () => {
    const draftPickObj = {round: 1, pickNumber: 12, type: LeagueLevel.LOW};
    const draftPick = new DraftPick(draftPickObj);

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(draftPick.round).toEqual(draftPickObj.round);
            expect(draftPick.pickNumber).toEqual(draftPickObj.pickNumber);
            expect(draftPick.type).toEqual(draftPickObj.type);
            expect(draftPick.currentOwner).toBeUndefined();
            expect(draftPick.season).toBeUndefined();
        });
    });

    describe("instance methods", () => {
        it("toString/0", () => {
            // tslint:disable-next-line:max-line-length
            const pattern = new RegExp(`${draftPick.type} draft pick, round: ${draftPick.round}, pick #${draftPick.pickNumber}`);
            expect(draftPick.toString()).toMatch(pattern);
            expect(draftPick.toString()).not.toMatch("Currently owned");
        });

        describe("equals/2", () => {
            const draftClone = clone(draftPick);
            const draftDiffLevel = new DraftPick({...draftPickObj, type: LeagueLevel.HIGH});
            const owner = new User({email: "test@example.com", password: "lol", roles: [Role.ADMIN]});
            const owner2 = new User({email: "test2@example.com", password: "lol", roles: [Role.ADMIN]});
            const draftWithOwner = new DraftPick({...draftPickObj, currentOwner: owner});
            const draftOwnerCloned = clone(draftWithOwner);
            const draftWithDiffOwner = new DraftPick({...draftPickObj, currentOwner: owner2});

            it("should return true if the two instances are identical. Excludes = default", () => {
                expect(draftPick.equals(draftClone)).toBeTrue();
                expect(draftWithOwner.equals(draftOwnerCloned)).toBeTrue();
            });
            it("should return true if the two instances are identical considering the excludes", () => {
                expect(draftPick.equals(draftWithOwner, {currentOwner: true})).toBeTrue();
                expect(draftPick.equals(draftDiffLevel, {type: true})).toBeTrue();
            });
            it("should throw a useful error if something doesn't match (simple props)", () => {
                expect(() => draftPick.equals(draftDiffLevel)).toThrowWithMessage(Error, "Not matching: type");
            });
            it("should throw a useful error if something doesn't match (model fields)", () => {
                expect(() => draftPick.equals(draftWithOwner)).toThrowWithMessage(Error, "Not matching: currentOwner");
                expect(() => draftWithDiffOwner.equals(draftWithOwner))
                    .toThrowWithMessage(Error, "Not matching: email");
            });
        });
    });
});
