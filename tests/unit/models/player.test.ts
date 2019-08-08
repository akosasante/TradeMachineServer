import "jest";
import "jest-extended";
import { clone } from "lodash";
import Player, { LeagueLevel } from "../../../src/models/player";
import Team from "../../../src/models/team";

describe("Player Class", () => {
    const playerObj = {id: 1, name: "Honus Wiener", league: LeagueLevel.HIGH};
    const player = new Player(playerObj);

    describe("constructor", () => {
        it("should construct the object as expected", () => {
            expect(player.name).toEqual(playerObj.name);
            expect(player.league).toEqual(playerObj.league);
            expect(player.leagueTeam).toBeUndefined();
            expect(player).toBeInstanceOf(Player);
            expect(playerObj).not.toBeInstanceOf(Player);
        });
    });

    describe("instance methods", () => {
        it("toString/0", () => {
            const pattern = new RegExp(`MLB Player ID#\\d+: ${player.name}`);
            expect(player.toString()).toMatch(pattern);
        });

        describe("equals/2", () => {
            const playerClone = clone(player);
            const playerWithDiffLevel = new Player({...playerObj, league: LeagueLevel.MAJOR});
            const team = new Team({name: "Squirtle Squad", espnId: 1});
            const playerWithTeam = new Player({...playerObj, leagueTeam: team});
            const playerWithTeamCloned = clone(playerWithTeam);
            const playerWithMeta = new Player({...playerObj, meta: {middleName: "Petra", position: "P"}});
            const playerWithMetaCloned = clone(playerWithMeta);

            it("should return true if the two instances are identical. Excludes = default", () => {
                expect(player.equals(playerClone)).toBeTrue();
                expect(playerWithTeam.equals(playerWithTeamCloned)).toBeTrue();
                expect(playerWithMeta.equals(playerWithMetaCloned)).toBeTrue();
            });

            it("should return true if the two instances are identical considering the excludes", () => {
                expect(player.equals(playerWithDiffLevel, {league: true})).toBeTrue();
                expect(player.equals(playerWithMeta, {meta: true})).toBeTrue();
                expect(player.equals(playerWithTeam, {leagueTeam: true})).toBeTrue();
            });

            it("should throw a useful error if something doesn't match (simple props)", () => {
                expect(() => player.equals(playerWithDiffLevel)).toThrowWithMessage(Error, "Not matching: league");
            });

            it("should throw a useful error if something doesn't match (complex fields)", () => {
                expect(() => player.equals(playerWithMeta)).toThrowWithMessage(Error, "Not matching: meta");
            });

            it("should throw a useful error if something doesn't match (model fields)", () => {
                expect(() => player.equals(playerWithTeam)).toThrowWithMessage(Error, "Not matching: leagueTeam");
            });
        });
    });

});
