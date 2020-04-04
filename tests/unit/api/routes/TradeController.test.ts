import "jest";
import "jest-extended";
import TradeController from "../../../../src/api/routes/TradeController";
import TradeDAO from "../../../../src/DAO/TradeDAO";
import Trade from "../../../../src/models/trade";
import { TradeParticipantType } from "../../../../src/models/tradeParticipant";
import { TradeFactory } from "../../../factories/TradeFactory";
import logger from "../../../../src/bootstrap/logger";
import { TradeItemType } from "../../../../src/models/tradeItem";
import { TeamFactory } from "../../../factories/TeamFactory";

describe("TradeController", () => {
    const mockTradeDAO = {
        getAllTrades: jest.fn(),
        getTradeById: jest.fn(),
        createTrade: jest.fn(),
        updateParticipants: jest.fn(),
        updateItems: jest.fn(),
        deleteTrade: jest.fn(),
    };

    const testTrade = TradeFactory.getTrade();
    const tradeController = new TradeController(mockTradeDAO as unknown as TradeDAO);

    beforeAll(() => {
        logger.debug("~~~~~~TRADE CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TRADE CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        Object.entries(mockTradeDAO).forEach((kvp: [string, jest.Mock<any, any>]) => {
            kvp[1].mockClear();
        });
    });

    describe("getAllTrades method", () => {
        it("should return an array of trades", async () => {
            mockTradeDAO.getAllTrades.mockReturnValueOnce([testTrade]);
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
            mockTradeDAO.getTradeById.mockReturnValueOnce(testTrade);
            const res = await tradeController.getOneTrade(testTrade.id!);

            expect(mockTradeDAO.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.getTradeById).toHaveBeenCalledWith(testTrade.id);
            expect(res).toEqual(testTrade);
        });
    });

    describe("createTrade method", () => {
        it("should create a trade", async () => {
            mockTradeDAO.createTrade.mockReturnValueOnce(testTrade);
            const res = await tradeController.createTrade(testTrade.parse());

            expect(mockTradeDAO.createTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.createTrade).toHaveBeenCalledWith(testTrade.parse());
            expect(res).toEqual(testTrade);
        });
    });

    describe("updateTrade method", () => {
        it("should call getTradeById once for validation", async () => {
            mockTradeDAO.getTradeById.mockReturnValueOnce(testTrade);
            await tradeController.updateTrade(testTrade.id!, testTrade.parse());

            expect(mockTradeDAO.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.getTradeById).toHaveBeenCalledWith(testTrade.id);
        });
        it("should call the updateParticipants method", async () => {
            mockTradeDAO.getTradeById.mockReturnValueOnce(testTrade);

            const newCreator = TradeFactory.getTradeCreator(TeamFactory.getTeam());
            const existingRecipient = testTrade.tradeParticipants!.find(p => p.participantType === TradeParticipantType.RECIPIENT);
            const existingCreator = testTrade.tradeParticipants!.find(p => p.participantType === TradeParticipantType.CREATOR);

            const updatedTrade = new Trade({...testTrade.parse(), tradeParticipants: [newCreator, existingRecipient!]});
            mockTradeDAO.updateItems.mockResolvedValueOnce(updatedTrade);

            const res = await tradeController.updateTrade(testTrade.id!, updatedTrade.parse());

            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledWith(testTrade.id, [newCreator], [existingCreator]);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledWith(testTrade.id, [], []);
            expect(res).toMatchObject({
                id: updatedTrade.id,
                tradeItems: expect.toIncludeSameMembers(testTrade.tradeItems!),
                tradeParticipants: expect.toIncludeSameMembers([newCreator, existingRecipient]),
            });
        });
        it("should call the updateItems method", async () => {
            mockTradeDAO.getTradeById.mockReturnValueOnce(testTrade);


            const newPick = TradeFactory.getTradedPick(undefined,
                testTrade.tradeParticipants![0].team,
                testTrade.tradeParticipants![1].team);
            const existingPlayers = testTrade.tradeItems!.filter(item => item.tradeItemType !== TradeItemType.PICK);
            const existingPick  = testTrade.tradeItems!.find(item => item.tradeItemType === TradeItemType.PICK);
            const updatedTrade = new Trade({...testTrade.parse(), tradeItems: [newPick, ...existingPlayers]});
            mockTradeDAO.updateItems.mockResolvedValueOnce(updatedTrade);

            const res = await tradeController.updateTrade(testTrade.id!, updatedTrade.parse());

            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledWith(testTrade.id,
                [newPick], [existingPick]);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledWith(testTrade.id, [], []);
            expect(res).toMatchObject({
                id: updatedTrade.id,
                tradeParticipants: expect.toIncludeSameMembers(testTrade.tradeParticipants!),
                tradeItems: expect.toIncludeSameMembers([newPick, ...existingPlayers]),
            });
        });
    });

    describe("deleteTrade method", () => {
        it("should delete a trade by id from the db", async () => {
            mockTradeDAO.deleteTrade.mockReturnValueOnce({raw: [ {id: testTrade.id} ], affected: 1});
            const res = await tradeController.deleteTrade(testTrade.id!);

            expect(mockTradeDAO.deleteTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.deleteTrade).toHaveBeenCalledWith(testTrade.id);
            expect(res).toEqual({deleteCount: 1, id: testTrade.id});
        });
    });
});
