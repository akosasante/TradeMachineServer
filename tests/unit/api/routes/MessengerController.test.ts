import "jest";
import "jest-extended";
import { MockObj } from "../../DAO/daoHelpers";
import logger from "../../../../src/bootstrap/logger";
import MessengerController from "../../../../src/api/routes/MessengerController";
import { EmailPublisher } from "../../../../src/email/publishers";
import TradeDAO from "../../../../src/DAO/TradeDAO";
import { TradeFactory } from "../../../factories/TradeFactory";
import { Response } from "express";
import { TradeStatus } from "../../../../src/models/trade";
import { BadRequestError } from "routing-controllers";
import {SlackPublisher} from "../../../../src/slack/publishers";

describe("MessengerController", () => {
    const mockEmailPublisher: MockObj = {
        queueTradeRequestMail: jest.fn(),
    };
    const mockSlackPublisher: MockObj = {
        queueTradeAnnouncement: jest.fn(),
    };
    const mockTradeDao: MockObj = {
        getTradeById: jest.fn(),
        hydrateTrade: jest.fn(),
    };
    const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    const pendingTrade = TradeFactory.getTrade(undefined, undefined, TradeStatus.PENDING);
    const acceptedTrade = TradeFactory.getTrade(undefined, undefined, TradeStatus.ACCEPTED);
    const draftTrade = TradeFactory.getTrade();

    const messengerController = new MessengerController(
        mockEmailPublisher as unknown as EmailPublisher,
        mockTradeDao as unknown as TradeDAO,
        mockSlackPublisher as unknown as SlackPublisher);

    beforeAll(() => {
        logger.debug("~~~~~~MESSENGER CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~MESSENGER CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        [mockEmailPublisher, mockTradeDao, mockSlackPublisher].forEach(mockedThing =>
            Object.values(mockedThing).forEach(mockFn => mockFn.mockReset()));
        Object.values(mockRes).forEach(mockFn => mockFn.mockClear());
    });

    describe("sendRequestTradeMessage/2", () => {
        it("should get a trade, hydrate it and queue an email", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(pendingTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(pendingTrade);
            await messengerController.sendRequestTradeMessage(pendingTrade.id!, mockRes as unknown as Response);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(pendingTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledWith(pendingTrade);
            expect(mockEmailPublisher.queueTradeRequestMail).toHaveBeenCalledTimes(1);
            expect(mockEmailPublisher.queueTradeRequestMail).toHaveBeenCalledWith(pendingTrade);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({status: "trade request queued"});
        });
        it("should return a BadRequest if trade is not pending", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(draftTrade);
            await expect(messengerController.sendRequestTradeMessage(draftTrade.id!, mockRes as unknown as Response)).rejects.toThrow(BadRequestError);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(draftTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(0);
            expect(mockEmailPublisher.queueTradeRequestMail).toHaveBeenCalledTimes(0);
        });
    });
    describe("sendTradeAnnouncementMessage/2", () => {
        it("should get a trade, hydrate it and then queue for slack announcement", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(acceptedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(acceptedTrade);
            await messengerController.sendTradeAnnouncementMessage(acceptedTrade.id!, mockRes as unknown as Response);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(acceptedTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledWith(acceptedTrade);
            expect(mockSlackPublisher.queueTradeAnnouncement).toHaveBeenCalledTimes(1);
            expect(mockSlackPublisher.queueTradeAnnouncement).toHaveBeenCalledWith(acceptedTrade);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({status: "accepted trade announcement queued"});
        });
        it("should return a BadRequest if trade is not pending", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(draftTrade);
            await expect(messengerController.sendTradeAnnouncementMessage(draftTrade.id!, mockRes as unknown as Response)).rejects.toThrow(BadRequestError);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(draftTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(0);
            expect(mockSlackPublisher.queueTradeAnnouncement).toHaveBeenCalledTimes(0);
        });
    });
});
