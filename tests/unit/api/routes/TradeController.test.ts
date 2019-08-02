import "jest";
import "jest-extended";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import TradeController from "../../../../src/api/routes/TradeController";
import TradeDAO from "../../../../src/DAO/TradeDAO";
import DraftPick from "../../../../src/models/draftPick";
import Player, { LeagueLevel } from "../../../../src/models/player";
import Team from "../../../../src/models/team";
import Trade from "../../../../src/models/trade";
import TradeItem, { TradeItemType } from "../../../../src/models/tradeItem";
import TradeParticipant, { TradeParticipantType } from "../../../../src/models/tradeParticipant";

describe("TradeController", () => {
    const mockTradeDAO = {
        getAllTrades: jest.fn(),
        getTradeById: jest.fn(),
        createTrade: jest.fn(),
        updateTrade: jest.fn(),
        deleteTrade: jest.fn(),

    };
    const minorPlayer = new Player({name: "Honus Wiener", league: LeagueLevel.HIGH});
    const majorPlayer = new Player({name: "Pete Buttjudge", league: LeagueLevel.MAJOR});
    const pick = new DraftPick({round: 1, pickNumber: 12, type: LeagueLevel.LOW});
    const creatorTeam = new Team({name: "Squirtle Squad", espnId: 1});
    const recipientTeam = new Team({name: "Ditto Duo", espnId: 2});
    const sender = new TradeParticipant({participantType: TradeParticipantType.RECIPIENT, team: recipientTeam});
    const recipient = new TradeParticipant({participantType: TradeParticipantType.CREATOR, team: creatorTeam});
    const tradedMajorPlayer = new TradeItem({tradeItemType: TradeItemType.PLAYER, player: majorPlayer,
        sender: creatorTeam, recipient: recipientTeam });
    const tradedMinorPlayer = new TradeItem({tradeItemType: TradeItemType.PLAYER, player: minorPlayer,
        sender: creatorTeam, recipient: recipientTeam });
    const tradedPick = new TradeItem({tradeItemType: TradeItemType.PICK, pick,
        sender: recipientTeam, recipient: creatorTeam });
    const tradeItems = [tradedMajorPlayer, tradedMinorPlayer, tradedPick];
    const testTrade = new Trade({id: 1, tradeItems, tradeParticipants: [sender, recipient]});
    const tradeController = new TradeController(mockTradeDAO as unknown as TradeDAO);

    afterEach(() => {
        Object.entries(mockTradeDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    describe("getAllTrades method", () => {
        it("should return an array of trades", async () => {
            mockTradeDAO.getAllTrades.mockReturnValue([testTrade]);
            const res = await tradeController.getAllTrades();

            expect(mockTradeDAO.getAllTrades).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.getAllTrades).toHaveBeenCalledWith();
            expect(res).toEqual([testTrade]);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockTradeDAO.getAllTrades.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(tradeController.getAllTrades())
                .rejects.toThrow(Error);
        });
    });

    describe("getOneTrade method", () => {
        it("should return a trade by id", async () => {
            mockTradeDAO.getTradeById.mockReturnValue(testTrade);
            const res = await tradeController.getOneTrade(testTrade.id!);

            expect(mockTradeDAO.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.getTradeById).toHaveBeenCalledWith(testTrade.id);
            expect(res).toEqual(testTrade);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockTradeDAO.getTradeById.mockImplementation(() => {
                throw new EntityNotFoundError(Trade, "ID not found.");
            });
            await expect(tradeController.getOneTrade(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("createTrade method", () => {
        it("should create a trade", async () => {
            mockTradeDAO.createTrade.mockReturnValue(testTrade);
            const res = await tradeController.createTrade(testTrade.parse());

            expect(mockTradeDAO.createTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.createTrade).toHaveBeenCalledWith(testTrade.parse());
            expect(res).toEqual(testTrade);
        });
        it("should bubble up any errors from the DAO", async () => {
            mockTradeDAO.createTrade.mockImplementation(() => {
                throw new Error("Generic Error");
            });
            await expect(tradeController.createTrade(testTrade.parse()))
                .rejects.toThrow(Error);
        });
    });

    describe("updateTrade method", () => {
        it("should return updated trade with the given id", async () => {
            mockTradeDAO.updateTrade.mockReturnValue(testTrade);
            const res = await tradeController.updateTrade(testTrade.id!, testTrade.parse());

            expect(mockTradeDAO.updateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateTrade).toHaveBeenCalledWith(testTrade.id, testTrade.parse());
            expect(res).toEqual(testTrade);
        });
        it("should throw an error if entity is not found in db", async () => {
            mockTradeDAO.updateTrade.mockImplementation(() => {
                throw new EntityNotFoundError(Trade, "ID not found.");
            });
            await expect(tradeController.updateTrade(9999, testTrade.parse()))
                .rejects.toThrow(EntityNotFoundError);
        });
    });

    describe("deleteTrade method", () => {
        it("should delete a trade by id from the db", async () => {
            mockTradeDAO.deleteTrade.mockReturnValue({raw: [ [], testTrade.id ]});
            const res = await tradeController.deleteTrade(testTrade.id!);

            expect(mockTradeDAO.deleteTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.deleteTrade).toHaveBeenCalledWith(testTrade.id);
            expect(res).toEqual({deleteResult: true, id: testTrade.id});
        });
        it("should throw an error if entity is not found in db", async () => {
            mockTradeDAO.deleteTrade.mockImplementation(() => {
                throw new EntityNotFoundError(Trade, "ID not found.");
            });
            await expect(tradeController.deleteTrade(9999))
                .rejects.toThrow(EntityNotFoundError);
        });
    });
});
