import "jest";
import "jest-extended";
import { clone } from "lodash";
import { NotFoundError } from "routing-controllers";
import * as typeorm from "typeorm";
import TradeDAO from "../../../src/DAO/TradeDAO";
import DraftPick from "../../../src/models/draftPick";
import Player, { LeagueLevel } from "../../../src/models/player";
import Team from "../../../src/models/team";
import Trade from "../../../src/models/trade";
import TradeItem, { TradeItemType } from "../../../src/models/tradeItem";
import TradeParticipant, { TradeParticipantType } from "../../../src/models/tradeParticipant";
import { mockDeleteChain, mockExecute, mockWhereInIds } from "./daoHelpers";

const mockTradeDb = {
    find: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
};

const mockTransaction = jest.fn();

// @ts-ignore
jest.spyOn(typeorm, "getConnection").mockReturnValue({
    getRepository: jest.fn().mockReturnValue(mockTradeDb),
    transaction: mockTransaction,
});

describe("TradeDAO", () => {
    const tradeDAO = new TradeDAO();
    const minorPlayer = new Player({name: "Honus Wiener", league: LeagueLevel.HIGH});
    const majorPlayer = new Player({name: "Pete Buttjudge", league: LeagueLevel.MAJOR});
    const pick = new DraftPick({round: 1, pickNumber: 12, type: LeagueLevel.LOW});
    const creatorTeam = new Team({name: "Squirtle Squad", espnId: 1});
    const recipientTeam = new Team({name: "Ditto Duo", espnId: 2});
    const sender = new TradeParticipant({participantType: TradeParticipantType.CREATOR, team: recipientTeam});
    const recipient = new TradeParticipant({participantType: TradeParticipantType.RECIPIENT, team: creatorTeam});
    const tradedMajorPlayer = new TradeItem({tradeItemType: TradeItemType.PLAYER, player: majorPlayer,
        sender: creatorTeam, recipient: recipientTeam });
    const tradedMinorPlayer = new TradeItem({tradeItemType: TradeItemType.PLAYER, player: minorPlayer,
        sender: creatorTeam, recipient: recipientTeam });
    const tradedPick = new TradeItem({tradeItemType: TradeItemType.PICK, pick,
        sender: recipientTeam, recipient: creatorTeam });
    const tradeItems = [tradedMajorPlayer, tradedMinorPlayer, tradedPick];
    const testTrade = new Trade({id: 1, tradeItems, tradeParticipants: [sender, recipient]});

    afterEach(() => {
        Object.entries(mockTradeDb).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
        mockExecute.mockClear();
        mockWhereInIds.mockClear();
    });

    afterAll(async () => {
        await tradeDAO.connection.close();
    });

    it("getAllTrades - should call the db find method once with no args", async () => {
        mockTradeDb.find.mockReturnValueOnce([testTrade.parse()]);
        const defaultOpts = {
            order: {id: "ASC"},
            relations: ["tradeParticipants", "tradeItems", "tradeParticipants.team",
                "tradeItems.sender", "tradeItems.recipient", "tradeItems.player", "tradeItems.pick"],
        };
        const res = await tradeDAO.getAllTrades();

        expect(mockTradeDb.find).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testTrade]);
    });

    it("getTradeById - should throw NotFoundError if no id is passed", async () => {
        // @ts-ignore
        await expect(tradeDAO.getTradeById(undefined)).rejects.toThrow(NotFoundError);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(0);
    });

    it("getTradeById - should call the db findOneOrFail once with id", async () => {
        mockTradeDb.findOneOrFail.mockReturnValueOnce(testTrade.parse());
        const defaultOpts = {relations: ["tradeParticipants", "tradeItems", "tradeParticipants.team",
                "tradeItems.sender", "tradeItems.recipient", "tradeItems.player", "tradeItems.pick"]};
        const res = await tradeDAO.getTradeById(1);

        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(1, defaultOpts);
        expect(res).toEqual(testTrade);
    });

    it("createTrade - should call the db save once with tradeObj", async () => {
        mockTransaction.mockReturnValueOnce(testTrade);
        const res = await tradeDAO.createTrade(testTrade.parse());

        expect(res).toEqual(testTrade);
    });

    // it("updateTrade - should call the db update and findOneOrFail once with id and tradeObj", async () => {
    //     mockTradeDb.findOneOrFail.mockReturnValueOnce(testTrade.parse());
    //     const res = await tradeDAO.updateTrade(1, testTrade.parse());
    //
    //     expect(mockTradeDb.update).toHaveBeenCalledTimes(1);
    //     expect(mockTradeDb.update).toHaveBeenCalledWith({id: 1}, testTrade.parse());
    //     expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(1);
    //     expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(1);
    //     expect(res).toEqual(testTrade);
    // });

    it("updateParticipants - should call createQueryBuilder and findOneOrFail with id and participants", async () => {
        const addAndRemove = jest.fn();
        const of = jest.fn(() => ({addAndRemove}));
        const relation = jest.fn(() => ({of}));
        mockTradeDb.createQueryBuilder.mockImplementationOnce(() => ({ relation }));
        mockTradeDb.findOneOrFail.mockReturnValue(testTrade.parse());
        const cloneSender = clone(sender);
        const res = await tradeDAO.updateParticipants(
            1,
            [cloneSender], [sender]);

        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledWith();
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(2);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(res).toEqual(testTrade);
    });
    it("updateTradeParticipants should throw an error if no id is passed", async () => {
        // @ts-ignore
        await expect(tradeDAO.updateParticipants(undefined)).rejects.toThrow(NotFoundError);
    });

    it("updateItems - should call createQueryBuilder and findOneOrFail with id and items", async () => {
        const addAndRemove = jest.fn();
        const of = jest.fn(() => ({addAndRemove}));
        const relation = jest.fn(() => ({of}));
        mockTradeDb.createQueryBuilder.mockImplementationOnce(() => ({ relation }));
        mockTradeDb.findOneOrFail.mockReturnValue(testTrade.parse());
        const cloneItem = clone(tradedMajorPlayer);
        const res = await tradeDAO.updateItems(
            1,
            [cloneItem], [tradedMajorPlayer]);

        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledWith();
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(2);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(res).toEqual(testTrade);
    });
    it("updateTradeItems should throw an error if no id is passed", async () => {
        // @ts-ignore
        await expect(tradeDAO.updateItems(undefined)).rejects.toThrow(NotFoundError);
    });

    it("deleteTrade - should call the db delete once with id", async () => {
        mockTradeDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain);
        const deleteResult = { raw: [{id: 1}], affected: 1};
        mockExecute.mockReturnValueOnce(deleteResult);
        const res = await tradeDAO.deleteTrade(1);

        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(1);
        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockWhereInIds).toHaveBeenCalledWith(1);
        expect(res).toEqual(deleteResult);
    });

    it("deleteTrade - should throw NotFoundError if no id is passed", async () => {
        // @ts-ignore
        await expect(tradeDAO.deleteTrade(undefined)).rejects.toThrow(NotFoundError);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(0);
        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledTimes(0);
    });
});
