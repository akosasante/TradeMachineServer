import "jest";
import "jest-extended";
import { clone } from "lodash";
import Team from "../../../src/models/team";
import User from "../../../src/models/user";
import { TeamFactory } from "../../factories/TeamFactory";
import { UserFactory } from "../../factories/UserFactory";

describe("Team Class", () => {
    const teamObj = TeamFactory.getTeamObject(undefined, undefined, {id: 1});
    const team = new Team(teamObj);

    describe("constructor", () => {
        it("should construct the obj as expected", async () => {
            expect(team.name).toEqual(teamObj.name);
            expect(team.espnId).toEqual(teamObj.espnId);
            expect(team.owners).toBeUndefined();
            expect(team).toBeInstanceOf(Team);
            expect(teamObj).not.toBeInstanceOf(Team);
        });
    });

    describe("getters", () => {
        it("publicTeam/0 - should return a team copy with owners' psswds cleaned", () => {
            team.owners = [UserFactory.getUser()];
            expect(team.publicTeam).toBeInstanceOf(Team);
            expect((team.publicTeam.owners || [])[0]).toBeInstanceOf(User);
            expect((team.publicTeam.owners || [])[0].password).toBeFalsy();
            expect((team.publicTeam.owners || [])[0].hasPassword).toBeTrue();
            team.owners = undefined; // Reset for following "equals/2" tests
        });
    });

    describe("instance methods", () => {
        it("toString/0", async () => {
            const pattern = new RegExp(`Fantasy Team ID#${team.id}: ${team.name}`);
            expect(team.toString()).toMatch(pattern);
        });

        describe("equals/2", () => {
            const sameTeamDiffOwners = new Team({...team, owners: [UserFactory.getUser()]});
            const sameTeamDiffEspn = new Team({...team, espnId: 2});
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
