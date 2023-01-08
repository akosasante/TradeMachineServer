import { PlayerFactory } from "../../../../factories/PlayerFactory";
import { Player } from "@prisma/client";
import PlayerDAO from "../../../../../src/DAO/v2/PlayerDAO";
import { mockDeep, mockClear } from "jest-mock-extended";
import PlayerController from "../../../../../src/api/routes/v2/PlayerController";
import logger from "../../../../../src/bootstrap/logger";

describe("[V2] PlayerController", () => {
    const testPlayer: Player = PlayerFactory.getPrismaPlayer();
    const Players = mockDeep<PlayerDAO>();
    const playerController = new PlayerController(Players);

    afterEach(() => {
        mockClear(Players);
    });
    beforeAll(() => {
        logger.debug("~~~~~~PRISMA PLAYER CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PRISMA PLAYER CONTROLLER TESTS COMPLETE~~~~~~");
    });

    describe("getAll()", () => {
        it("should return an array of all players in the db", async () => {
            Players.getAllPlayers.mockResolvedValueOnce([testPlayer]);

            const res = await playerController.getAll();

            expect(Players.getAllPlayers).toHaveBeenCalledTimes(1);
            expect(Players.getAllPlayers).toHaveBeenCalledWith();
            expect(res).toEqual([testPlayer]);
        });
        it("should return an array of filtered players when called with some 'where' params", async () => {
            Players.findPlayers.mockResolvedValueOnce([testPlayer]);

            const res = await playerController.getAll(["mlbTeam.LAD", "name.Akosua"]);

            expect(Players.findPlayers).toHaveBeenCalledTimes(1);
            expect(Players.findPlayers).toHaveBeenCalledWith(["mlbTeam.LAD", "name.Akosua"]);
            expect(res).toEqual([testPlayer]);
        });
    });
});
