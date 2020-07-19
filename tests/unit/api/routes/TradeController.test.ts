import "jest";
import "jest-extended";
import TradeController from "../../../../src/api/routes/TradeController";
import TradeDAO from "../../../../src/DAO/TradeDAO";
import Trade, { TradeStatus } from "../../../../src/models/trade";
import { TradeParticipantType } from "../../../../src/models/tradeParticipant";
import { TradeFactory } from "../../../factories/TradeFactory";
import logger from "../../../../src/bootstrap/logger";
import { UserFactory } from "../../../factories/UserFactory";
import { BadRequestError, UnauthorizedError } from "routing-controllers";
import { TeamFactory } from "../../../factories/TeamFactory";
import { TradeItemType } from "../../../../src/models/tradeItem";
import * as TradeTracker from "../../../../src/csv/TradeTracker";


describe("TradeController", () => {
    const mockTradeDAO = {
        getAllTrades: jest.fn(),
        getTradeById: jest.fn(),
        hydrateTrade: jest.fn(),
        createTrade: jest.fn(),
        updateStatus: jest.fn(),
        updateParticipants: jest.fn(),
        updateItems: jest.fn(),
        updateDeclinedBy: jest.fn(),
        deleteTrade: jest.fn(),
    };

    // @ts-ignore
    TradeTracker.appendNewTrade = jest.fn();

    const testTrade = TradeFactory.getTrade();
    const creator = testTrade.tradeParticipants?.find(part => part.participantType === TradeParticipantType.CREATOR);
    const recipient = testTrade.tradeParticipants?.find(part => part.participantType === TradeParticipantType.RECIPIENT);
    const tradeOwner = UserFactory.getOwnerUser();
    creator!.team!.owners = [tradeOwner];
    const tradeRecipient = UserFactory.getOwnerUser();
    recipient!.team!.owners = [tradeRecipient];
    const tradeController = new TradeController(mockTradeDAO as unknown as TradeDAO);

    beforeAll(() => {
        logger.debug("~~~~~~TRADE CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TRADE CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        Object.values(mockTradeDAO).forEach(mockFn => mockFn.mockReset());
    });

    describe("getAllTrades method", () => {
        it("should return an array of trades", async () => {
            mockTradeDAO.getAllTrades.mockResolvedValueOnce([testTrade]);
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
            mockTradeDAO.getTradeById.mockResolvedValueOnce(testTrade);
            const res = await tradeController.getOneTrade(testTrade.id!);

            expect(mockTradeDAO.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.getTradeById).toHaveBeenCalledWith(testTrade.id);
            expect(res).toEqual(testTrade);
        });
        it("should hydrate the trade if the boolean is set to true", async () => {
            mockTradeDAO.getTradeById.mockResolvedValueOnce(testTrade);
            mockTradeDAO.hydrateTrade.mockResolvedValueOnce(testTrade);
            const res = await tradeController.getOneTrade(testTrade.id!, true);

            expect(mockTradeDAO.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.getTradeById).toHaveBeenCalledWith(testTrade.id);
            expect(mockTradeDAO.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.hydrateTrade).toHaveBeenCalledWith(testTrade);
            expect(res).toEqual(testTrade);
        });
    });

    describe("createTrade method", () => {
        it("should create a trade", async () => {
            mockTradeDAO.createTrade.mockResolvedValueOnce(testTrade);
            const res = await tradeController.createTrade(tradeOwner, testTrade.parse());

            expect(mockTradeDAO.createTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.createTrade).toHaveBeenCalledWith(testTrade.parse());
            expect(res).toEqual(testTrade);
        });
        it("should throw a BadRequestError if a non-admin tries to create a trade with an invalid status", async () => {
            const invalidTrade = new Trade({...testTrade, status: TradeStatus.ACCEPTED});
            await expect(tradeController.createTrade(tradeOwner, invalidTrade.parse())).rejects.toThrow(BadRequestError);
        });
    });

    describe("updateTrade method", () => {
        beforeEach(() => {
            mockTradeDAO.getTradeById.mockResolvedValueOnce(testTrade);
        });
        it("should throw an error if a non-admin, non-trade participator tries to update it", async () => {
            const otherUser = UserFactory.getOwnerUser();
            await expect(tradeController.updateTrade(otherUser, testTrade.id!, testTrade.parse())).rejects.toThrow(UnauthorizedError);
        });
        it("should allow any updates by admins even if not part of the trade", async () => {
            const otherUser = UserFactory.getAdminUser();
            await tradeController.updateTrade(otherUser, testTrade.id!, {status: TradeStatus.ACCEPTED, tradeParticipants: [], tradeItems: []});

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateStatus).toBeCalledWith(testTrade.id, TradeStatus.ACCEPTED);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledWith(testTrade.id, [], testTrade.tradeItems);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledWith(testTrade.id, [], testTrade.tradeParticipants);
        });
        it("should not call updateStatus DAO method if user is requesting an invalid status state change", async () => {
            // Trying to go from DRAFT -> ACCEPTED as trade owner is not an allowed state change
            await tradeController.updateTrade(tradeOwner, testTrade.id!, {status: TradeStatus.ACCEPTED, tradeParticipants: [], tradeItems: []});

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(1);
        });
        it("should call updateStatus DAO method if user is requesting a valid status state change", async () => {
            // Trying to go from DRAFT -> ACCEPTED as trade owner is not an allowed state change
            await tradeController.updateTrade(tradeOwner, testTrade.id!, {status: TradeStatus.REQUESTED});

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(1);
        });
        it("should not allow updates to draft trade if not creator of the trade", async () => {
            await tradeController.updateTrade(tradeRecipient, testTrade.id!, {status: TradeStatus.REQUESTED});

            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(0);
        });
        it("should not allow updates to trade items or participants if not the owner of the trade", async () => {
            await tradeController.updateTrade(tradeRecipient, testTrade.id!, {tradeParticipants: [], tradeItems: []});

            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(0);
        });
        it("should not allow item/participant updates to non-draft trades", async () => {
            const activeTrade = new Trade({...testTrade, status: TradeStatus.ACCEPTED});
            mockTradeDAO.getTradeById.mockReset();
            mockTradeDAO.getTradeById.mockResolvedValue(activeTrade);

            await tradeController.updateTrade(tradeOwner, testTrade.id!, {tradeParticipants: [], tradeItems: []});

            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(0);
        });
        it("should call the updateParticipants method with correct args", async () => {
            const newCreator = TradeFactory.getTradeCreator(TeamFactory.getTeam());
            const updatedTrade = new Trade({...testTrade.parse(), tradeParticipants: [newCreator, recipient!]});
            mockTradeDAO.updateParticipants.mockResolvedValueOnce(updatedTrade);
            mockTradeDAO.updateItems.mockResolvedValueOnce(updatedTrade);

            const res = await tradeController.updateTrade(tradeOwner, testTrade.id!, updatedTrade.parse());

            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledWith(testTrade.id, [newCreator], [creator]);
            expect(res).toMatchObject({
                id: updatedTrade.id,
                tradeItems: expect.toIncludeSameMembers(testTrade.tradeItems!),
                tradeParticipants: expect.toIncludeSameMembers([newCreator, recipient]),
            });
        });
        it("should call the updateItems method with correct args", async () => {
            const newPick = TradeFactory.getTradedPick(undefined,
                testTrade.tradeParticipants![0].team,
                testTrade.tradeParticipants![1].team);
            const existingPlayers = testTrade.tradeItems!.filter(item => item.tradeItemType !== TradeItemType.PICK);
            const existingPick  = testTrade.tradeItems!.find(item => item.tradeItemType === TradeItemType.PICK);
            const updatedTrade = new Trade({...testTrade.parse(), tradeItems: [newPick, ...existingPlayers]});
            mockTradeDAO.updateItems.mockResolvedValueOnce(updatedTrade);
            mockTradeDAO.updateParticipants.mockResolvedValueOnce(updatedTrade);

            const res = await tradeController.updateTrade(tradeOwner, testTrade.id!, updatedTrade.parse());

            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledWith(testTrade.id,
                [newPick], [existingPick]);
            expect(res).toMatchObject({
                id: updatedTrade.id,
                tradeParticipants: expect.toIncludeSameMembers(testTrade.tradeParticipants!),
                tradeItems: expect.toIncludeSameMembers([newPick, ...existingPlayers]),
            });
        });
        it("should call the updateDeclinedBy DAO method if valid", async () => {
            const declinedById = testTrade.tradeParticipants?.[1].team.owners?.[0].id;
            const declinedReason = "reason";
            await tradeController.updateTrade(tradeOwner, testTrade.id!, {declinedById, declinedReason});

            expect(mockTradeDAO.updateDeclinedBy).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.updateDeclinedBy).toHaveBeenCalledWith(testTrade.id, declinedById, declinedReason);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(0);
        });
        it("should not call updateDeclinedBy DAO method if declined by user is not one of the trade's own participants", async () => {
            const declinedById = TradeFactory.getTrade().tradeParticipants?.[1].team.owners?.[0].id;
            const declinedReason = "reason";
            await tradeController.updateTrade(tradeOwner, testTrade.id!, {declinedById, declinedReason});

            expect(mockTradeDAO.updateDeclinedBy).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateStatus).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateItems).toHaveBeenCalledTimes(0);
            expect(mockTradeDAO.updateParticipants).toHaveBeenCalledTimes(0);
        });
    });

    describe("deleteTrade method", () => {
        it("should delete a trade by id from the db", async () => {
            mockTradeDAO.deleteTrade.mockResolvedValueOnce({raw: [ {id: testTrade.id} ], affected: 1});
            const res = await tradeController.deleteTrade(testTrade.id!);

            expect(mockTradeDAO.deleteTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDAO.deleteTrade).toHaveBeenCalledWith(testTrade.id);
            expect(res).toEqual({deleteCount: 1, id: testTrade.id});
        });
    });
});
