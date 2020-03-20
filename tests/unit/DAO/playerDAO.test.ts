import "jest";
import "jest-extended";
import { Repository } from "typeorm";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import Player, { LeagueLevel } from "../../../src/models/player";
import { PlayerFactory } from "../../factories/PlayerFactory";
import { MockDb, mockDeleteChain, mockExecute, mockWhereInIds } from "./daoHelpers";
import logger from "../../../src/bootstrap/logger";

describe("PlayerDAO", () => {
    const mockPlayerDb: MockDb = {
        find: jest.fn(),
        findOneOrFail: jest.fn(),
        save: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        createQueryBuilder: jest.fn(),
    };

    const testPlayer1 = PlayerFactory.getPlayer();
    const playerDAO: PlayerDAO = new PlayerDAO(mockPlayerDb as unknown as Repository<Player>);

    afterEach(() => {
        Object.keys(mockPlayerDb).forEach((action: string) => {
            (mockPlayerDb[action as keyof MockDb] as jest.Mock).mockClear();
        });

        mockExecute.mockClear();
        mockWhereInIds.mockClear();
    });

    beforeAll(() => {
        logger.debug("~~~~~~USER DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~USER DAO TESTS COMPLETE~~~~~~");
    });

    it("getAllPlayers - should call the db find method once with no args", async () => {
        mockPlayerDb.find.mockReturnValueOnce([testPlayer1]);
        const defaultOpts = {order: {id: "ASC"}};
        const res = await playerDAO.getAllPlayers();

        expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testPlayer1]);
    });

    it("getPlayerById - should call the db findOneOrFail once with id", async () => {
        mockPlayerDb.findOneOrFail.mockReturnValueOnce(testPlayer1);
        const res = await playerDAO.getPlayerById(testPlayer1.id!);

        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledWith(testPlayer1.id);
        expect(res).toEqual(testPlayer1);
    });

    it("findPlayers - should call the db find once with query", async () => {
        const query = {league: LeagueLevel.HIGH};
        mockPlayerDb.find.mockReturnValueOnce([testPlayer1]);
        const res = await playerDAO.findPlayers(query);

        expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.find).toHaveBeenCalledWith({where: query});
        expect(res).toEqual([testPlayer1]);
    });

    it("createPlayer - should call the db save once with playerObj", async () => {
        mockPlayerDb.insert.mockReturnValueOnce({identifiers: [{id: testPlayer1.id!}], generatedMaps: [], raw: []});
        mockPlayerDb.find.mockReturnValueOnce(testPlayer1);
        const res = await playerDAO.createPlayers([testPlayer1]);

        expect(mockPlayerDb.insert).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.insert).toHaveBeenCalledWith([testPlayer1.parse()]);
        expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.find).toHaveBeenCalledWith({"id": {"_multipleParameters": true, "_type": "in", "_useParameter": true, "_value": [testPlayer1.id]}});

        expect(res).toEqual(testPlayer1);
    });

    it("updatePlayer - should call the db update and findOneOrFail once with id and teamObj", async () => {
        mockPlayerDb.findOneOrFail.mockReturnValueOnce(testPlayer1);
        const res = await playerDAO.updatePlayer(testPlayer1.id!, testPlayer1.parse());

        expect(mockPlayerDb.update).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.update).toHaveBeenCalledWith({id: testPlayer1.id}, testPlayer1.parse());
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledWith(testPlayer1.id);
        expect(res).toEqual(testPlayer1);
    });

    it("deletePlayer - should call the db delete once with id", async () => {
        mockPlayerDb.findOneOrFail.mockReturnValueOnce(testPlayer1);
        mockPlayerDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain);
        const deleteResult = { affected: 1, raw: {id: testPlayer1.id!} };
        mockExecute.mockReturnValueOnce(deleteResult);
        const res = await playerDAO.deletePlayer(testPlayer1.id!);

        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledWith(testPlayer1.id!);
        expect(mockPlayerDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockWhereInIds).toHaveBeenCalledWith(testPlayer1.id!);

        expect(res).toEqual(deleteResult);
    });

    it("deleteAllPlayers - should delete the players in chunks", async () => {
        mockPlayerDb.find.mockReturnValueOnce([]);
        await playerDAO.deleteAllPlayers();
        expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.remove).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.remove).toHaveBeenCalledWith([], {chunk: 10});
    });

    describe("deleteAllPlayers - should pass in the appropriate query parameter if required",  () => {
        const findMinorLeaguesCondition = {league:
                {_multipleParameters: true, _type: "in", _useParameter: true, _value: ["High Minors", "Low Minors"]}};
        mockPlayerDb.find.mockReturnValue([]);

        it("should handle the case 'major' correctly", async () => {
            await playerDAO.deleteAllPlayers("major");
            expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
            expect(mockPlayerDb.find).toHaveBeenCalledWith({league: LeagueLevel.MAJOR});
            expect(mockPlayerDb.remove).toHaveBeenCalledTimes(1);
            expect(mockPlayerDb.remove).toHaveBeenCalledWith([], {chunk: 10});
        });
        it("should handle the case 'minor' correctly", async () => {
            await playerDAO.deleteAllPlayers("minor");
            expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
            expect(mockPlayerDb.find).toHaveBeenCalledWith(findMinorLeaguesCondition);
            expect(mockPlayerDb.remove).toHaveBeenCalledTimes(1);
            expect(mockPlayerDb.remove).toHaveBeenCalledWith([], {chunk: 10});
        });
        it("should handle the case with specific LeagueLevels correctly", async () => {
            await playerDAO.deleteAllPlayers(LeagueLevel.LOW);
            expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
            expect(mockPlayerDb.find).toHaveBeenCalledWith({league: LeagueLevel.LOW});
            expect(mockPlayerDb.remove).toHaveBeenCalledTimes(1);
            expect(mockPlayerDb.remove).toHaveBeenCalledWith([], {chunk: 10});
        });
    });

    it("batchCreatePlayers - should call the db save once with playerObjs", async () => {
        mockPlayerDb.save.mockReturnValueOnce([testPlayer1]);
        const res = await playerDAO.batchCreatePlayers([testPlayer1]);

        expect(mockPlayerDb.save).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.save).toHaveBeenCalledWith([testPlayer1], {chunk: 10});
        expect(res).toEqual([testPlayer1]);
    });
});
