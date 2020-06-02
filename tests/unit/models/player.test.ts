import "jest";
import "jest-extended";
import Player from "../../../src/models/player";
import { PlayerFactory } from "../../factories/PlayerFactory";
import logger from "../../../src/bootstrap/logger";

describe("Player Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~PLAYER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PLAYER TESTS COMPLETE~~~~~~");
    });

    const playerObj = PlayerFactory.getPlayerObject();
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
        it("toString/0 - should return a string with the UUID", () => {
            expect(player.toString()).toMatch(player.id!);
            expect(player.toString()).toMatch("Player#");
        });

        it("parse/1 - should take a player and return a POJO", () => {
            expect(player).toBeInstanceOf(Player);
            expect(player.parse()).not.toBeInstanceOf(Player);
            expect(player.parse()).toEqual(playerObj);
            expect(player.parse()).toEqual(expect.any(Object));
        });
    });

});
