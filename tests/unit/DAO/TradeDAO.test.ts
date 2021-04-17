import "jest-extended";
import { Repository } from "typeorm";
import TradeDAO from "../../../src/DAO/TradeDAO";
import { TradeFactory } from "../../factories/TradeFactory";
import { mockDeleteChain, mockExecute, MockObj, mockWhereInIds } from "./daoHelpers";
import Trade, { TradeStatus } from "../../../src/models/trade";
import logger from "../../../src/bootstrap/logger";
import { v4 as uuid } from "uuid";
import TradeItem from "../../../src/models/tradeItem";
import TradeParticipant from "../../../src/models/tradeParticipant";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import DraftPickDAO from "../../../src/DAO/DraftPickDAO";


describe("TradeDAO", () => {
    const mockTradeDb: MockObj = {
        find: jest.fn(),
        findOneOrFail: jest.fn(),
        save: jest.fn(),
        createQueryBuilder: jest.fn(),
        update: jest.fn(),
    };
    const mockPlayerDao: MockObj = {
        getPlayerById: jest.fn(),
    };
    const mockPickDao: MockObj = {
        getPickById: jest.fn(),
    };

    const testTrade = TradeFactory.getTrade();
    const tradeDAO = new TradeDAO(mockTradeDb as unknown as Repository<Trade>, mockPlayerDao as unknown as PlayerDAO, mockPickDao as unknown as DraftPickDAO);

    afterEach(() => {
        [mockTradeDb, mockPlayerDao, mockPickDao]
            .forEach(mockedThing => Object.values(mockedThing)
                .forEach(mockFn => mockFn.mockReset()));
        mockWhereInIds.mockClear();
        mockExecute.mockClear();
    });

    beforeAll(() => {
        logger.debug("~~~~~~TRADE DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TRADE DAO TESTS COMPLETE~~~~~~");
    });


    it("getAllTrades - should call the db find method once with option args", async () => {
        mockTradeDb.find.mockResolvedValueOnce([testTrade]);
        const defaultOpts = { order: { id: "ASC" } };
        const res = await tradeDAO.getAllTrades();

        expect(mockTradeDb.find).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.find).toHaveBeenCalledWith(defaultOpts);
        expect(res).toEqual([testTrade]);
    });

    it("getTradeById - should call the db findOneOrFail once with id", async () => {
        mockTradeDb.findOneOrFail.mockResolvedValueOnce(testTrade);
        const res = await tradeDAO.getTradeById(testTrade.id!);

        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(testTrade.id);
        expect(res).toEqual(testTrade);
    });

    it("createTrade - should call the db save once with tradeObj", async () => {
        mockTradeDb.save.mockResolvedValueOnce(testTrade);
        mockTradeDb.findOneOrFail.mockResolvedValueOnce(testTrade);
        const res = await tradeDAO.createTrade(testTrade.parse());

        expect(mockTradeDb.save).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.save).toHaveBeenCalledWith(testTrade.parse());
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(testTrade.id!);
        expect(res).toEqual(testTrade);
    });

    it("updateStatus - should call the db update and findOneOrFail once with id and status field", async () => {
        mockTradeDb.findOneOrFail.mockResolvedValueOnce(testTrade);
        const status = TradeStatus.PENDING;
        const res = await tradeDAO.updateStatus(testTrade.id!, status);

        expect(mockTradeDb.update).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.update).toHaveBeenCalledWith({ id: testTrade.id! }, { status });
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(testTrade.id!);
        expect(res).toEqual(testTrade);
    });

    it("updateDeclinedBy - should call the db update and findOneOrFail once with id and declined by field", async () => {
        mockTradeDb.findOneOrFail.mockResolvedValueOnce(testTrade);
        const participant = testTrade.tradeParticipants?.[0].id;
        const res = await tradeDAO.updateDeclinedBy(testTrade.id!, participant!, "reason");

        expect(mockTradeDb.update).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.update).toHaveBeenCalledWith({ id: testTrade.id! }, {
            declinedById: participant,
            declinedReason: "reason",
        });
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(testTrade.id!);
        expect(res).toEqual(testTrade);
    });

    it("updateAcceptedBy - should call the db update and findOneOrFail once with id and accepted by field", async () => {
        mockTradeDb.findOneOrFail.mockResolvedValueOnce(testTrade);
        const participant = testTrade.tradeParticipants?.[0].id;
        const res = await tradeDAO.updateAcceptedBy(testTrade.id!, [participant!]);

        expect(mockTradeDb.update).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.update).toHaveBeenCalledWith({ id: testTrade.id! }, {
            acceptedBy: [participant],
            acceptedOnDate: expect.any(Date),
        });
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(testTrade.id!);
        expect(res).toEqual(testTrade);
    });

    it("updateParticipants - should call createQueryBuilder and findOneOrFail with id and participants", async () => {
        const addAndRemove = jest.fn();
        const of = jest.fn(() => ({addAndRemove}));
        const relation = jest.fn(() => ({of}));
        mockTradeDb.createQueryBuilder.mockImplementationOnce(() => ({ relation }));
        mockTradeDb.findOneOrFail.mockReturnValue(testTrade);
        const otherParticipant = new TradeParticipant({...testTrade.tradeParticipants![0].parse(), id: uuid()});
        const res = await tradeDAO.updateParticipants(
            testTrade.id!,
            [otherParticipant], [testTrade.tradeParticipants![0]]);

        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledWith();
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(2);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(testTrade.id!);
        expect(res).toEqual(testTrade);
    });

    it("updateItems - should call createQueryBuilder and findOneOrFail with id and items", async () => {
        const addAndRemove = jest.fn();
        const of = jest.fn(() => ({addAndRemove}));
        const relation = jest.fn(() => ({of}));
        mockTradeDb.createQueryBuilder.mockImplementationOnce(() => ({ relation }));
        mockTradeDb.findOneOrFail.mockReturnValue(testTrade);
        const otherPlayer = new TradeItem({...testTrade.tradeItems![0].parse(), id: uuid()});
        const res = await tradeDAO.updateItems(
            testTrade.id!,
            [otherPlayer], [testTrade.tradeItems![0]]);

        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledWith();
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(2);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(testTrade.id!);
        expect(res).toEqual(testTrade);
    });

    it("deleteTrade - should call the db delete once with id", async () => {
        mockTradeDb.findOneOrFail.mockResolvedValueOnce(testTrade);
        mockTradeDb.createQueryBuilder.mockReturnValueOnce(mockDeleteChain);
        const deleteResult = { raw: [{ id: testTrade.id! }], affected: 1 };
        mockExecute.mockResolvedValueOnce(deleteResult);
        const res = await tradeDAO.deleteTrade(testTrade.id!);

        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledTimes(1);
        expect(mockTradeDb.findOneOrFail).toHaveBeenCalledWith(testTrade.id!);
        expect(mockTradeDb.createQueryBuilder).toHaveBeenCalledTimes(1);
        expect(mockWhereInIds).toHaveBeenCalledWith(testTrade.id!);
        expect(res).toEqual(deleteResult);
    });

    it("hydrateTrade - should call the correct dao methods", async () => {
        await tradeDAO.hydrateTrade(testTrade);
        expect(mockPlayerDao.getPlayerById).toHaveBeenCalledTimes(2);
        expect(mockPickDao.getPickById).toHaveBeenCalledTimes(1);
    });
});
