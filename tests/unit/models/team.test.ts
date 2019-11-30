import "jest";
import "jest-extended";
import { clone } from "lodash";
import TeamDO from "../../../src/models/team";
import { TeamFactory } from "../../factories/TeamFactory";
import { UserFactory } from "../../factories/UserFactory";

describe("Team Class", () => {
    const teamObj = TeamFactory.getTeamObject(undefined, undefined, {id: "d4e3fe52-1b18-4cb6-96b1-600ed86ec45b"});
    const team = new TeamDO(teamObj);

    describe("constructor", () => {
        it("should construct the obj as expected", async () => {
            expect(team.name).toEqual(teamObj.name);
            expect(team.espnId).toEqual(teamObj.espnId);
            expect(team.owners).toBeUndefined();
            expect(team).toBeInstanceOf(TeamDO);
            expect(teamObj).not.toBeInstanceOf(TeamDO);
        });
    });

    describe("instance methods", () => {
        it("toString/0", async () => {
            expect(team.toString()).toMatch(team.id!);
            expect(team.toString()).toMatch("TeamDO#");
        });

        describe("equals/2", () => {
            const sameTeamDiffOwners = new TeamDO({...team, owners: [UserFactory.getUser()]});
            const sameTeamDiffEspn = new TeamDO({...team, espnId: 2});
            const sameTeam = clone(team);

            it("should return true if the two instances are identical. Excludes = default", async () => {
                expect(team.equals(sameTeam)).toBeTrue();
            });

            it("should return true if the two instances are identical considering the excludes", async () => {
                expect(team.equals(sameTeamDiffEspn, {espnId: true})).toBeTrue();
            });

            it("should throw a useful error if something doesn't match (props)", async () => {
                expect(() => team.equals(sameTeamDiffEspn)).toThrowWithMessage(Error, "Not matching: espnId");
            });

            it("should throw  a useful error if something doesn't match (objects)", () => {
                expect(() => team.equals(sameTeamDiffOwners)).toThrowWithMessage(Error, "Not matching: owners");
            });
        });
    });
});
