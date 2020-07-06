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
import { SlackPublisher } from "../../../../src/slack/publishers";
import { UserFactory } from "../../../factories/UserFactory";

describe("MessengerController", () => {
    const mockEmailPublisher: MockObj = {
        queueTradeRequestMail: jest.fn(),
        queueTradeDeclinedMail: jest.fn(),
        queueTradeAcceptedMail: jest.fn(),
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
    const requestedTrade = TradeFactory.getTrade(undefined, undefined, TradeStatus.REQUESTED);
    requestedTrade.tradeParticipants?.forEach(tp => {
        tp.team.owners = [UserFactory.getUser("owner1@example.com"), UserFactory.getUser("owner2@example.com")];
    });
    const acceptedTrade = TradeFactory.getTrade(undefined, undefined, TradeStatus.ACCEPTED);
    acceptedTrade.tradeParticipants?.forEach(tp => {
        tp.team.owners = [UserFactory.getUser("owner1@example.com"), UserFactory.getUser("owner2@example.com")];
    });
    const declinedTrade = TradeFactory.getTrade(undefined, undefined, TradeStatus.REJECTED, {declinedReason: "reason"});
    declinedTrade.tradeParticipants?.forEach((tp, index) => {
        tp.team.owners = [UserFactory.getUser(`owner1_tp${index}@example.com`), UserFactory.getUser(`owner2_tp${index}@example.com`)];
    });
    declinedTrade.declinedById = declinedTrade.tradeParticipants?.[1].team?.owners?.[0].id;
    const draftTrade = TradeFactory.getTrade();
    draftTrade.tradeParticipants?.forEach(tp => {
        tp.team.owners = [UserFactory.getUser("owner1@example.com"), UserFactory.getUser("owner2@example.com")];
    });

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
        it("should get a trade, hydrate it and queue emails for each recipient owner", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(requestedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(requestedTrade);
            await messengerController.sendRequestTradeMessage(requestedTrade.id!, mockRes as unknown as Response);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(requestedTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledWith(requestedTrade);
            expect(mockEmailPublisher.queueTradeRequestMail).toHaveBeenCalledTimes(2);
            expect(mockEmailPublisher.queueTradeRequestMail).toHaveBeenCalledWith(requestedTrade, expect.stringMatching(/owner\d@example.com/));
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({status: "trade request queued"});
        });
        it("should return a BadRequest if trade is not requested", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(draftTrade);
            await expect(messengerController.sendRequestTradeMessage(draftTrade.id!, mockRes as unknown as Response)).rejects.toThrow(BadRequestError);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(draftTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(0);
            expect(mockEmailPublisher.queueTradeRequestMail).toHaveBeenCalledTimes(0);
        });
    });
    describe("sendTradeDeclineMessage/2", () => {
        it("should get a trade, hydrate it, and queue emails for each non-declining user", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(declinedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(declinedTrade);
            await messengerController.sendTradeDeclineMessage(declinedTrade.id!, mockRes as unknown as Response);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(declinedTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledWith(declinedTrade);
            expect(mockEmailPublisher.queueTradeDeclinedMail).toHaveBeenCalledTimes(2);
            expect(mockEmailPublisher.queueTradeDeclinedMail).toHaveBeenCalledWith(declinedTrade, expect.stringMatching(/owner\d_tp0@example.com/));
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({status: "trade decline email queued"});
        });
        it("should return a BadRequest if trade is not rejected", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(draftTrade);
            await expect(messengerController.sendTradeDeclineMessage(draftTrade.id!, mockRes as unknown as Response)).rejects.toThrow(BadRequestError);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(draftTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(0);
            expect(mockEmailPublisher.queueTradeDeclinedMail).toHaveBeenCalledTimes(0);
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

    describe("sendTradeAcceptanceMessage/2", () => {
        it("should get a trade, hydrate it and queue emails for each creator owner", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(acceptedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(acceptedTrade);
            await messengerController.sendTradeAcceptanceMessage(acceptedTrade.id!, mockRes as unknown as Response);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(acceptedTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledWith(acceptedTrade);
            expect(mockEmailPublisher.queueTradeAcceptedMail).toHaveBeenCalledTimes(2);
            expect(mockEmailPublisher.queueTradeAcceptedMail).toHaveBeenCalledWith(acceptedTrade, expect.stringMatching(/owner\d@example.com/));
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({status: "trade acceptance email queued"});
        });
        it("should return a BadRequest if trade is not rejected", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(draftTrade);
            await expect(messengerController.sendTradeAcceptanceMessage(draftTrade.id!, mockRes as unknown as Response)).rejects.toThrow(BadRequestError);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(draftTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(0);
            expect(mockEmailPublisher.queueTradeAcceptedMail).toHaveBeenCalledTimes(0);
        });
    });
});
