import "jest";
import "jest-extended";
import { Repository } from "typeorm";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import Player, { PlayerLeagueType } from "../../../src/models/player";
import { PlayerFactory } from "../../factories/PlayerFactory";
import { MockObj, mockDeleteChain, mockExecute, mockWhereInIds } from "./daoHelpers";
import logger from "../../../src/bootstrap/logger";

describe("PlayerDAO", () => {
    const mockPlayerDb: MockObj = {
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
            (mockPlayerDb[action as keyof MockObj] as jest.Mock).mockClear();
        });

        mockExecute.mockClear();
        mockWhereInIds.mockClear();
    });

    beforeAll(() => {
        logger.debug("~~~~~~PLAYER DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PLAYER DAO TESTS COMPLETE~~~~~~");
    });

    it("getAllPlayers - should call the db find method once with option args", async () => {
        mockPlayerDb.find.mockResolvedValueOnce([testPlayer1]);
        const defaultOpts = {order: {id: "ASC"}};
        const res = await playerDAO.getAllPlayers();

        expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testPlayer1]);
    });

    it("getPlayerById - should call the db findOneOrFail once with id", async () => {
        mockPlayerDb.findOneOrFail.mockResolvedValueOnce(testPlayer1);
        const res = await playerDAO.getPlayerById(testPlayer1.id!);

        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledWith(testPlayer1.id);
        expect(res).toEqual(testPlayer1);
    });

    it("findPlayers - should call the db find once with query", async () => {
        const query = {league: PlayerLeagueType.MINOR};
        mockPlayerDb.find.mockResolvedValueOnce([testPlayer1]);
        const res = await playerDAO.findPlayers(query);

        expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.find).toHaveBeenCalledWith({where: query});
        expect(res).toEqual([testPlayer1]);
    });

    it("createPlayer - should call the db save once with playerObj", async () => {
        mockPlayerDb.insert.mockResolvedValueOnce({identifiers: [{id: testPlayer1.id!}], generatedMaps: [], raw: []});
        mockPlayerDb.find.mockResolvedValueOnce(testPlayer1);
        const res = await playerDAO.createPlayers([testPlayer1]);

        expect(mockPlayerDb.insert).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.insert).toHaveBeenCalledWith([testPlayer1.parse()]);
        expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.find).toHaveBeenCalledWith({"id": {"_multipleParameters": true, "_type": "in", "_useParameter": true, "_value": [testPlayer1.id]}});

        expect(res).toEqual(testPlayer1);
    });

    it("updatePlayer - should call the db update and findOneOrFail once with id and teamObj", async () => {
        mockPlayerDb.findOneOrFail.mockResolvedValueOnce(testPlayer1);
        const res = await playerDAO.updatePlayer(testPlayer1.id!, testPlayer1.parse());

        expect(mockPlayerDb.update).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.update).toHaveBeenCalledWith({id: testPlayer1.id}, testPlayer1.parse());
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledWith(testPlayer1.id);
        expect(res).toEqual(testPlayer1);
    });

    it("deletePlayer - should call the db delete once with id", async () => {
        mockPlayerDb.findOneOrFail.mockResolvedValueOnce(testPlayer1);
        mockPlayerDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain);
        const deleteResult = { affected: 1, raw: {id: testPlayer1.id!} };
        mockExecute.mockResolvedValueOnce(deleteResult);
        const res = await playerDAO.deletePlayer(testPlayer1.id!);

        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledWith(testPlayer1.id!);
        expect(mockPlayerDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockWhereInIds).toHaveBeenCalledWith(testPlayer1.id!);

        expect(res).toEqual(deleteResult);
    });

    describe("deleteAllPlayers - should delete all queried players in chunks",  () => {
        it("should delete queried players", async () => {
            const query = {league: PlayerLeagueType.MINOR};
            mockPlayerDb.find.mockResolvedValueOnce([testPlayer1]);
            await playerDAO.deleteAllPlayers(query);

            expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
            expect(mockPlayerDb.find).toHaveBeenCalledWith({where: query});
            expect(mockPlayerDb.remove).toHaveBeenCalledTimes(1);
            expect(mockPlayerDb.remove).toHaveBeenCalledWith([testPlayer1], {chunk: 10});
        });
        it("should delete all players if no query passed in", async () => {
            mockPlayerDb.find.mockResolvedValueOnce([testPlayer1]);
            await playerDAO.deleteAllPlayers();

            expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
            expect(mockPlayerDb.find).toHaveBeenCalledWith({order: {id: "ASC"}});
            expect(mockPlayerDb.remove).toHaveBeenCalledTimes(1);
            expect(mockPlayerDb.remove).toHaveBeenCalledWith([testPlayer1], {chunk: 10});
        });
    });

    it("batchCreatePlayers - should call the db save once with playerObjs", async () => {
        mockPlayerDb.save.mockResolvedValueOnce([testPlayer1]);
        const res = await playerDAO.batchCreatePlayers([testPlayer1]);

        expect(mockPlayerDb.save).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.save).toHaveBeenCalledWith([testPlayer1], {chunk: 10});
        expect(res).toEqual([testPlayer1]);
    });

    it("batchUpsertPlayers - should call the db upsert chain", async () => {
        const mockOnConflict = jest.fn().mockReturnValue({execute: mockExecute});
        const mockValues = jest.fn().mockReturnValue({onConflict: mockOnConflict});
        const mockInsertChain = jest.fn().mockReturnValue({values: mockValues});
        mockPlayerDb.createQueryBuilder.mockReturnValueOnce({insert: mockInsertChain});
        mockExecute.mockResolvedValueOnce({identifiers: [{id: testPlayer1.id!}], generatedMaps: [], raw: []});
        mockPlayerDb.find.mockResolvedValueOnce([testPlayer1]);

        const res = await playerDAO.batchUpsertPlayers([testPlayer1]);

        expect(mockPlayerDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.createQueryBuilder).toHaveBeenCalledWith();
        expect(mockValues).toHaveBeenCalledTimes(1);
        expect(mockValues).toHaveBeenCalledWith([testPlayer1]);
        expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.find).toHaveBeenCalledWith({"id": {"_multipleParameters": true, "_type": "in", "_useParameter": true, "_value": [testPlayer1.id]}});
        expect(res).toEqual([testPlayer1]);
    });
});
