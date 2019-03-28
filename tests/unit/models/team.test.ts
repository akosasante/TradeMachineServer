import "jest";
import "jest-extended";
import { clone } from "lodash";
import Team from "../../../src/models/team";
import User, { Role } from "../../../src/models/user";

describe("Team Class", () => {
    const teamObj = {name: "Squirtle Squad", espnId: 1};
    const team = new Team(teamObj);

    it("should construct the obj as expected", async () => {
        expect(team.name).toEqual(teamObj.name);
        expect(team.espnId).toEqual(teamObj.espnId);
        expect(team.id).not.toBeDefined();
        expect(team.owners).toBeUndefined();
    });

    it("toString/0", async () => {
        expect(team.toString()).toMatch(team.name);
        expect(team.toString()).toMatch("Team#");
    });

    describe("equals/2", () => {
        const user1 = new User({email: "test@example.com", password: "lol", roles: [Role.ADMIN]});
        const team2 = new Team({name: "Squirtle Squad", espnId: 1, owners: [user1]});
        const team3 = new Team({name: "Squirtle Squad", espnId: 2});
        const team4 = clone(team);

        it("should return true if the two instances are identical. Excludes = default", async () => {
            expect(team.equals(team4)).toBeTrue();
        });

        it("should return true if the two instances are identical considering the excludes", async () => {
            expect(team.equals(team3, {espnId: true}));
        });

        it("should throw a useful error if something doesn't match (props)", async () => {
            expect(() => team.equals(team3)).toThrowWithMessage(Error, "Not matching: espnId");
        });

        it("should throw  a useful error if something doesn't match (objects)", () => {
            expect(() => team.equals(team2)).toThrowWithMessage(Error, "Not matching: owners");
        });
    });
});
