import "jest";
import "jest-extended";
import { NotFoundError } from "routing-controllers";
import * as typeorm from "typeorm";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import Player, { LeagueLevel } from "../../../src/models/player";

const mockPlayerDb = {
    find: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

// @ts-ignore
jest.spyOn(typeorm, "getConnection").mockReturnValue({
    getRepository: jest.fn().mockReturnValue(mockPlayerDb)});

describe("PlayerDAO", () => {
    const playerDAO = new PlayerDAO();
    const testPlayer1 = new Player({id: 1, name: "Honus Wiener", league: LeagueLevel.HIGH});

    afterEach(() => {
        Object.entries(mockPlayerDb).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    it("getAllPlayers - should call the db find method once with no args", async () => {
        mockPlayerDb.find.mockReturnValueOnce([testPlayer1.parse()]);
        const defaultOpts = {order: {id: "ASC"}};
        const res = await playerDAO.getAllPlayers();

        expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testPlayer1]);
    });

    it("getPlayerById - should throw NotFoundError if no id is passed in", async () => {
        // @ts-ignore
        await expect(playerDAO.getPlayerById(undefined)).rejects.toThrow(NotFoundError);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(0);
    });

    it("getPlayerById - should call the db findOneOrFail once with id", async () => {
        mockPlayerDb.findOneOrFail.mockReturnValueOnce(testPlayer1.parse());
        const res = await playerDAO.getPlayerById(1);

        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(res).toEqual(testPlayer1);
    });

    it("findPlayers - should call the db find once with query", async () => {
        const query = {league: LeagueLevel.HIGH};
        mockPlayerDb.find.mockReturnValueOnce([testPlayer1.parse()]);
        const res = await playerDAO.findPlayers(query);

        expect(mockPlayerDb.find).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.find).toHaveBeenCalledWith({where: query});
        expect(res).toEqual([testPlayer1]);
    });

    it("createPlayer - should call the db save once with playerObj", async () => {
        mockPlayerDb.save.mockReturnValueOnce(testPlayer1.parse());
        const res = await playerDAO.createPlayer(testPlayer1.parse());

        expect(mockPlayerDb.save).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.save).toHaveBeenCalledWith(testPlayer1.parse());
        expect(res).toEqual(testPlayer1);
    });

    it("updatePlayer - should call the db update and findOneOrFail once with id and teamObj", async () => {
        mockPlayerDb.findOneOrFail.mockReturnValueOnce(testPlayer1.parse());
        const res = await playerDAO.updatePlayer(1, testPlayer1.parse());

        expect(mockPlayerDb.update).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.update).toHaveBeenCalledWith({id: 1}, testPlayer1.parse());
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(res).toEqual(testPlayer1);
    });

    it("deletePlayer - should throw NotFoundError if no id is passed", async () => {
        // @ts-ignore
        await expect(playerDAO.deletePlayer(undefined)).rejects.toThrow(NotFoundError);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(0);
        expect(mockPlayerDb.delete).toHaveBeenCalledTimes(0);
    });

    it("deletePlayer - should call the db delete once with id", async () => {
        const deleteResult = { raw: [[], 1 ]};
        mockPlayerDb.delete.mockReturnValueOnce(deleteResult);
        const res = await playerDAO.deletePlayer(1);

        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(mockPlayerDb.delete).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.delete).toHaveBeenCalledWith(1);
        expect(res).toEqual(deleteResult);
    });

    it("batchCreatePlayers - should call the db save once with playerObjs", async () => {
        mockPlayerDb.save.mockReturnValueOnce([testPlayer1.parse()]);
        const res = await playerDAO.batchCreatePlayers([testPlayer1.parse()]);

        expect(mockPlayerDb.save).toHaveBeenCalledTimes(1);
        expect(mockPlayerDb.save).toHaveBeenCalledWith([testPlayer1.parse()], {chunk: 10});
        expect(res).toEqual([testPlayer1]);
    });
});