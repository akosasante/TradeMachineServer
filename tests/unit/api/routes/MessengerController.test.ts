import { MockObj } from "../../DAO/daoHelpers";
import logger from "../../../../src/bootstrap/logger";
import MessengerController from "../../../../src/api/routes/MessengerController";
import { EmailPublisher } from "../../../../src/email/publishers";
import TradeDAO from "../../../../src/DAO/TradeDAO";
import ObanDAO from "../../../../src/DAO/v2/ObanDAO";
import { TradeFactory } from "../../../factories/TradeFactory";
import { Response } from "express";
import { TradeStatus } from "../../../../src/models/trade";
import { BadRequestError } from "routing-controllers";
import { SlackPublisher } from "../../../../src/slack/publishers";
import { UserFactory } from "../../../factories/UserFactory";
import { TeamFactory } from "../../../factories/TeamFactory";

// Mock trade action token generation to avoid Redis dependency in unit tests
jest.mock("../../../../src/api/routes/v2/utils/tradeActionTokens", () => ({
    createTradeActionToken: jest.fn().mockResolvedValue("mock-token-abc123"),
}));

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
    const mockObanDao: MockObj = {
        enqueueTradeRequestEmail: jest.fn().mockResolvedValue({ id: BigInt(1) }),
    };
    const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };

    const requestedTrade = TradeFactory.getTrade(undefined, undefined, TradeStatus.REQUESTED);
    requestedTrade.tradeParticipants?.forEach(tp => {
        tp.team.owners = [
            UserFactory.getUser(`owner1_${tp.participantType}@example.com`),
            UserFactory.getUser(`owner2_${tp.participantType}@example.com`),
        ];
    });

    const acceptedTrade = TradeFactory.getTrade(undefined, undefined, TradeStatus.ACCEPTED);
    acceptedTrade.tradeParticipants?.forEach(tp => {
        tp.team.owners = [
            UserFactory.getUser(`owner1_${tp.participantType}@example.com`),
            UserFactory.getUser(`owner2_${tp.participantType}@example.com`),
        ];
    });

    const submittedTrade = TradeFactory.getTrade(undefined, undefined, TradeStatus.SUBMITTED);
    submittedTrade.tradeParticipants?.forEach(tp => {
        tp.team.owners = [UserFactory.getUser("owner1_s@example.com"), UserFactory.getUser("owner2_s@example.com")];
    });

    const declinedTrade = TradeFactory.getTrade(undefined, undefined, TradeStatus.REJECTED, {
        declinedReason: "reason",
    });
    declinedTrade.tradeParticipants?.forEach((tp, index) => {
        tp.team.owners = [
            UserFactory.getUser(`owner1_tp${index + 1}@example.com`),
            UserFactory.getUser(`owner2_tp${index + 1}@example.com`),
        ];
    });
    const thirdParticipant = TradeFactory.getTradeRecipient(TeamFactory.getTeam(), declinedTrade);
    thirdParticipant.team.owners = [
        UserFactory.getUser("owner1_tp3@example.com"),
        UserFactory.getUser("owner2_tp3@example.com"),
    ];
    declinedTrade.tradeParticipants?.push(thirdParticipant);
    declinedTrade.declinedById = declinedTrade.tradeParticipants?.[1].team?.owners?.[0].id;
    const decliningEmail = declinedTrade.tradeParticipants?.[1].team?.owners?.[0].email;

    const draftTrade = TradeFactory.getTrade();
    draftTrade.tradeParticipants?.forEach(tp => {
        tp.team.owners = [UserFactory.getUser("owner1@example.com"), UserFactory.getUser("owner2@example.com")];
    });

    const messengerController = new MessengerController(
        mockEmailPublisher as unknown as EmailPublisher,
        mockTradeDao as unknown as TradeDAO,
        mockSlackPublisher as unknown as SlackPublisher,
        mockObanDao as unknown as ObanDAO
    );

    beforeAll(() => {
        logger.debug("~~~~~~MESSENGER CONTROLLER TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~MESSENGER CONTROLLER TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        [mockEmailPublisher, mockTradeDao, mockSlackPublisher, mockObanDao].forEach(mockedThing =>
            Object.values(mockedThing).forEach(mockFn => mockFn.mockReset())
        );
        Object.values(mockRes).forEach(mockFn => mockFn.mockClear());
        // Reset mocked enqueueTradeRequestEmail to its default resolved value after each test
        mockObanDao.enqueueTradeRequestEmail.mockResolvedValue({ id: BigInt(1) });
    });

    describe("sendRequestTradeMessage/2", () => {
        it("should fetch trade with owner relations and enqueue Oban jobs for each recipient owner", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(requestedTrade);
            await messengerController.sendRequestTradeMessage(requestedTrade.id!, mockRes as unknown as Response);

            // Fetches with explicit owner relations — no hydrateTrade needed
            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(requestedTrade.id, [
                "tradeParticipants",
                "tradeParticipants.team",
                "tradeParticipants.team.owners",
            ]);
            expect(mockTradeDao.hydrateTrade).not.toHaveBeenCalled();

            // One Oban job per recipient owner (recipient participant has 2 owners)
            expect(mockObanDao.enqueueTradeRequestEmail).toHaveBeenCalledTimes(2);
            expect(mockObanDao.enqueueTradeRequestEmail).toHaveBeenCalledWith(
                requestedTrade.id,
                expect.any(String), // userId
                expect.stringContaining("/trade/"), // V2 accept URL (USE_V3_TRADE_LINKS not set in test env)
                expect.stringContaining("/trade/"), // V2 decline URL
                expect.anything() // trace context (may be undefined or an object in test env)
            );
            expect(mockEmailPublisher.queueTradeRequestMail).not.toHaveBeenCalled();

            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledWith({ status: "trade request queued" });
        });

        it("should return a BadRequest if trade is not requested", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(draftTrade);
            await expect(
                messengerController.sendRequestTradeMessage(draftTrade.id!, mockRes as unknown as Response)
            ).rejects.toThrow(BadRequestError);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(draftTrade.id, [
                "tradeParticipants",
                "tradeParticipants.team",
                "tradeParticipants.team.owners",
            ]);
            expect(mockTradeDao.hydrateTrade).not.toHaveBeenCalled();
            expect(mockObanDao.enqueueTradeRequestEmail).not.toHaveBeenCalled();
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

            // Trade has a creator and 2 recipients. Each with two owners.
            // We're going to email everyone except the decliner
            expect(mockEmailPublisher.queueTradeDeclinedMail).toHaveBeenCalledTimes(5);
            expect(mockEmailPublisher.queueTradeDeclinedMail).toHaveBeenCalledWith(
                declinedTrade,
                expect.stringMatching(/owner\d_tp\d@example.com/)
            );
            expect(mockEmailPublisher.queueTradeDeclinedMail).not.toHaveBeenCalledWith(declinedTrade, decliningEmail);

            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({ status: "trade decline email queued" });
        });
        it("should return a BadRequest if trade is not rejected", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(draftTrade);
            await expect(
                messengerController.sendTradeDeclineMessage(draftTrade.id!, mockRes as unknown as Response)
            ).rejects.toThrow(BadRequestError);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(draftTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(0);
            expect(mockEmailPublisher.queueTradeDeclinedMail).toHaveBeenCalledTimes(0);
        });
    });

    describe("sendTradeAnnouncementMessage/2", () => {
        it("should get a trade, hydrate it and then queue for slack announcement", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(submittedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(submittedTrade);
            await messengerController.sendTradeAnnouncementMessage(submittedTrade.id!, mockRes as unknown as Response);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(submittedTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledWith(submittedTrade);

            // No matter the number of trade participants, we only make a single call to slack
            expect(mockSlackPublisher.queueTradeAnnouncement).toHaveBeenCalledTimes(1);
            expect(mockSlackPublisher.queueTradeAnnouncement).toHaveBeenCalledWith(submittedTrade);
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({ status: "accepted trade announcement queued" });
        });
        it("should return a BadRequest if trade is not submitted", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(draftTrade);
            await expect(
                messengerController.sendTradeAnnouncementMessage(draftTrade.id!, mockRes as unknown as Response)
            ).rejects.toThrow(BadRequestError);

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

            // Trade creator has two owners; each should get an email. We added the `_1` only to the creator emails for this test.
            expect(mockEmailPublisher.queueTradeAcceptedMail).toHaveBeenCalledTimes(2);
            expect(mockEmailPublisher.queueTradeAcceptedMail).toHaveBeenCalledWith(
                acceptedTrade,
                expect.stringMatching(/owner\d_1@example.com/)
            );
            expect(mockEmailPublisher.queueTradeAcceptedMail).not.toHaveBeenCalledWith(
                acceptedTrade,
                expect.stringMatching(/owner\d_2@example.com/)
            );
            expect(mockRes.status).toHaveBeenCalledTimes(1);
            expect(mockRes.status).toHaveBeenCalledWith(202);
            expect(mockRes.json).toHaveBeenCalledTimes(1);
            expect(mockRes.json).toHaveBeenCalledWith({ status: "trade acceptance email queued" });
        });
        it("should return a BadRequest if trade is not accepted", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(draftTrade);
            await expect(
                messengerController.sendTradeAcceptanceMessage(draftTrade.id!, mockRes as unknown as Response)
            ).rejects.toThrow(BadRequestError);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(draftTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(0);
            expect(mockEmailPublisher.queueTradeAcceptedMail).toHaveBeenCalledTimes(0);
        });
    });
});
