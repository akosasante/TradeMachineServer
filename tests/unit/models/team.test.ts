import logger from "../../../src/bootstrap/logger";
import Team from "../../../src/models/team";
import { TeamFactory } from "../../factories/TeamFactory";

describe("Team Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~TEAM TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TEAM TESTS COMPLETE~~~~~~");
    });
    const teamObj = TeamFactory.getTeamObject(undefined, undefined, { id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b" });
    const team = new Team(teamObj);

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(team.name).toEqual(teamObj.name);
            expect(team.espnId).toEqual(teamObj.espnId);
            expect(team.owners).toBeUndefined();
            expect(team).toBeInstanceOf(Team);
            expect(teamObj).not.toBeInstanceOf(Team);
        });
    });

    describe("instance methods", () => {
        it("toString/0 - should return a string with the UUID", () => {
            expect(team.toString()).toMatch(team.id!);
            expect(team.toString()).toMatch("Team#");
        });

        it("parse/1 - should take a team and return a POJO", () => {
            expect(team).toBeInstanceOf(Team);
            expect(team.parse()).not.toBeInstanceOf(Team);
            expect(team.parse()).toEqual(teamObj);
            expect(team.parse()).toEqual(expect.any(Object));
        });
    });
});
