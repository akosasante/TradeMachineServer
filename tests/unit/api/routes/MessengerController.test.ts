import "jest";
import "jest-extended";
import { MockObj } from "../../DAO/daoHelpers";
import logger from "../../../../src/bootstrap/logger";
import MessengerController from "../../../../src/api/routes/MessengerController";
import { EmailPublisher } from "../../../../src/email/publishers";
import TradeDAO from "../../../../src/DAO/TradeDAO";
import { TradeFactory } from "../../../factories/TradeFactory";
import { Response } from "express";

describe("MessengerController", () => {
    const mockEmailPublisher: MockObj = {
        queueTradeRequestMail: jest.fn(),
    };
    const mockTradeDao: MockObj = {
        getTradeById: jest.fn(),
        hydrateTrade: jest.fn(),
    };
    const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    const testTrade = TradeFactory.getTrade();

    const messengerController = new MessengerController(
        mockEmailPublisher as unknown as EmailPublisher,
        mockTradeDao as unknown as TradeDAO);

    beforeAll(() => {
        logger.debug("~~~~~~MESSENGER CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~MESSENGER CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        [mockEmailPublisher, mockTradeDao].forEach(mockedThing =>
            Object.values(mockedThing).forEach(mockFn => mockFn.mockReset()));
        Object.values(mockRes).forEach(mockFn => mockFn.mockClear());
    });

    it("sendRequestTradeMessage - should get a trade, hydrate it and queue an email", async () => {
        mockTradeDao.getTradeById.mockResolvedValueOnce(testTrade);
        mockTradeDao.hydrateTrade.mockResolvedValueOnce(testTrade);
        await messengerController.sendRequestTradeMessage(testTrade.id!, mockRes as unknown as Response);

        expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
        expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(testTrade.id);
        expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(1);
        expect(mockTradeDao.hydrateTrade).toHaveBeenCalledWith(testTrade);
        expect(mockEmailPublisher.queueTradeRequestMail).toHaveBeenCalledTimes(1);
        expect(mockEmailPublisher.queueTradeRequestMail).toHaveBeenCalledWith(testTrade);
        expect(mockRes.status).toHaveBeenCalledTimes(1);
        expect(mockRes.status).toHaveBeenCalledWith(202);
        expect(mockRes.json).toHaveBeenCalledTimes(1);
        expect(mockRes.json).toHaveBeenCalledWith({status: "trade request queued"});
    });
});
