import Player, { PlayerLeagueType } from "../../../src/models/player";
import { PlayerFactory } from "../../factories/PlayerFactory";
import logger from "../../../src/bootstrap/logger";
import { clone } from "lodash";

describe("Player Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~PLAYER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PLAYER TESTS COMPLETE~~~~~~");
    });

    const playerObj = PlayerFactory.getPlayerObject();
    const player = new Player(playerObj);
    const espnPlayer = {
        id: 2966,
        lineupLocked: true,
        onTeamId: 0,
        player: {
            active: true,
            defaultPositionId: 1,
            droppable: true,
            eligibleSlots: [12, 9, 13, 14, 16, 17],
            firstName: "Luis",
            fullName: "Luis Ortiz",
            gamesPlayedByPosition: { "1": 1 },
            id: 2966,
            injured: false,
            injuryStatus: "ACTIVE",
            jersey: "59",
            lastName: "Ortiz",
            proTeamId: 1,
        },
        ratings: {
            "0": { positionalRanking: 326, totalRanking: 1353, totalRating: -3.5 },
            "1": { positionalRanking: 0, totalRanking: 0, totalRating: 0.0 },
            "2": { positionalRanking: 0, totalRanking: 0, totalRating: 0.0 },
            "3": { positionalRanking: 0, totalRanking: 0, totalRating: 0.0 },
        },
        rosterLocked: true,
        status: "FREEAGENT",
        tradeLocked: false,
    };

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

        it("getEspnEligiblePositions/0 - should return a comma-separated list of eligible ESPN positions for the player", () => {
            const convertedPlayer = Player.convertEspnMajorLeaguerToPlayer(espnPlayer);
            const eligiblePositions = convertedPlayer.getEspnEligiblePositions();
            expect(eligiblePositions).toBe("CF, SP");
        });
    });

    describe("static methods", () => {
        const convertedPlayer = Player.convertEspnMajorLeaguerToPlayer(espnPlayer);
        const {
            player: { fullName: ignoreFullName },
            ...noNamePlayer
        } = clone(espnPlayer);

        it("convertEspnMajorLeaguerToPlayer/1 - should always assume major league players", () => {
            expect(convertedPlayer.league).toEqual(PlayerLeagueType.MAJOR);
        });
        it("convertEspnMajorLeaguerToPlayer/1 - should use the full name field if available or the player id otherwise", () => {
            expect(convertedPlayer.name).toBe("Luis Ortiz");
            expect(Player.convertEspnMajorLeaguerToPlayer(noNamePlayer).name).toBe("ESPN Player #2966");
        });
        it("convertEspnMajorLeaguerToPlayer/1 - should convert the mlb team id to the abbreviated team name", () => {
            expect(convertedPlayer.mlbTeam).toBe("BAL");
        });
        it("convertEspnMajorLeaguerToPlayer/1 - should pass along the espn player id and other info", () => {
            expect(convertedPlayer.meta).toMatchObject({ espnPlayer });
            expect(convertedPlayer.meta).toMatchObject({ position: "SP" });
        });
    });
});
