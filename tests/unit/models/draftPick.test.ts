import "jest";
import "jest-extended";
import DraftPick from "../../../src/models/draftPick";
import { DraftPickFactory } from "../../factories/DraftPickFactory";
import logger from "../../../src/bootstrap/logger";

describe("DraftPick Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~DRAFT PICK TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~DRAFT PICK TESTS COMPLETE~~~~~~");
    });

    const draftPickObj = DraftPickFactory.getPickObject();
    const draftPick = new DraftPick(draftPickObj);

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(draftPick.round).toEqual(draftPickObj.round);
            expect(draftPick.pickNumber).toEqual(draftPickObj.pickNumber);
            expect(draftPick.type).toEqual(draftPickObj.type);
            expect(draftPick.season).toEqual(draftPickObj.season);
            expect(draftPick.currentOwner).toBeUndefined();
            expect(draftPick.originalOwner).toBeUndefined();
            expect(draftPick).toBeInstanceOf(DraftPick);
            expect(draftPickObj).not.toBeInstanceOf(DraftPick);
        });
    });

    describe("instance methods", () => {
        it("toString/0 - should return a string with the UUID", () => {
            expect(draftPick.toString()).toMatch(draftPick.id!);
            expect(draftPick.toString()).toMatch("DraftPick#");
        });
        it("parse/1 - should take a draft pick and return a POJO", () => {
            expect(draftPick).toBeInstanceOf(DraftPick);
            expect(draftPick.parse()).not.toBeInstanceOf(DraftPick);
            expect(draftPick.parse()).toEqual(draftPickObj);
            expect(draftPick.parse()).toEqual(expect.any(Object));
        });
    });
});
