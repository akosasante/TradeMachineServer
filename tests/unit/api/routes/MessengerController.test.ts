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

jest.mock("../../../../src/utils/userNotificationPrefs", () => ({
    getOwnerNotificationPrefs: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock("../../../../src/bootstrap/prisma-db", () => ({
    getPrismaClientFromRequest: jest.fn().mockReturnValue(undefined),
}));

import { getOwnerNotificationPrefs, OwnerNotificationPrefs } from "../../../../src/utils/userNotificationPrefs";
import { getPrismaClientFromRequest } from "../../../../src/bootstrap/prisma-db";

const mockGetOwnerNotificationPrefs = getOwnerNotificationPrefs as jest.MockedFunction<
    typeof getOwnerNotificationPrefs
>;
const mockGetPrismaClientFromRequest = getPrismaClientFromRequest as jest.MockedFunction<
    typeof getPrismaClientFromRequest
>;

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
        enqueueTradeDeclinedEmail: jest.fn().mockResolvedValue({ id: BigInt(2) }),
        enqueueTradeSubmitEmail: jest.fn().mockResolvedValue({ id: BigInt(3) }),
        enqueueTradeRequestDm: jest.fn().mockResolvedValue({ id: BigInt(4) }),
        enqueueTradeDeclinedDm: jest.fn().mockResolvedValue({ id: BigInt(5) }),
        enqueueTradeSubmitDm: jest.fn().mockResolvedValue({ id: BigInt(6) }),
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
        // Reset mocked Oban enqueue methods to their default resolved values after each test
        mockObanDao.enqueueTradeRequestEmail.mockResolvedValue({ id: BigInt(1) });
        mockObanDao.enqueueTradeDeclinedEmail.mockResolvedValue({ id: BigInt(2) });
        mockObanDao.enqueueTradeSubmitEmail.mockResolvedValue({ id: BigInt(3) });
        mockObanDao.enqueueTradeRequestDm.mockResolvedValue({ id: BigInt(4) });
        mockObanDao.enqueueTradeDeclinedDm.mockResolvedValue({ id: BigInt(5) });
        mockObanDao.enqueueTradeSubmitDm.mockResolvedValue({ id: BigInt(6) });
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
            expect(mockObanDao.enqueueTradeRequestDm).not.toHaveBeenCalled();
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
        it("should get a trade, hydrate it, and enqueue Oban jobs for each non-declining user", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(declinedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(declinedTrade);
            await messengerController.sendTradeDeclineMessage(declinedTrade.id!, mockRes as unknown as Response);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(declinedTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledWith(declinedTrade);

            // Trade has a creator and 2 recipients. Each with two owners.
            // We enqueue one Oban job per non-declining owner (6 owners - 1 decliner = 5)
            expect(mockObanDao.enqueueTradeDeclinedEmail).toHaveBeenCalledTimes(5);
            expect(mockObanDao.enqueueTradeDeclinedEmail).toHaveBeenCalledWith(
                declinedTrade.id,
                expect.any(String), // userId
                expect.any(Boolean), // isCreator
                undefined, // declineUrl — V2 mode (USE_V3_TRADE_LINKS not set in test env)
                expect.anything() // traceContext
            );
            // The decliner's owner ID should never appear
            const decliningOwnerId = declinedTrade.tradeParticipants?.[1].team?.owners?.[0].id;
            expect(mockObanDao.enqueueTradeDeclinedEmail).not.toHaveBeenCalledWith(
                declinedTrade.id,
                decliningOwnerId,
                expect.anything(),
                expect.anything(),
                expect.anything()
            );
            expect(mockObanDao.enqueueTradeDeclinedDm).not.toHaveBeenCalled();
            expect(mockEmailPublisher.queueTradeDeclinedMail).not.toHaveBeenCalled();

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
            expect(mockObanDao.enqueueTradeDeclinedEmail).toHaveBeenCalledTimes(0);
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
        it("should get a trade, hydrate it and enqueue Oban submit jobs for each creator owner", async () => {
            mockTradeDao.getTradeById.mockResolvedValueOnce(acceptedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(acceptedTrade);
            await messengerController.sendTradeAcceptanceMessage(acceptedTrade.id!, mockRes as unknown as Response);

            expect(mockTradeDao.getTradeById).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.getTradeById).toHaveBeenCalledWith(acceptedTrade.id);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledTimes(1);
            expect(mockTradeDao.hydrateTrade).toHaveBeenCalledWith(acceptedTrade);

            // Trade creator has two owners; each should get an Oban job with a V2 submit URL
            // (USE_V3_TRADE_LINKS is not set in test env)
            expect(mockObanDao.enqueueTradeSubmitEmail).toHaveBeenCalledTimes(2);
            expect(mockObanDao.enqueueTradeSubmitEmail).toHaveBeenCalledWith(
                acceptedTrade.id,
                expect.any(String), // creator owner userId
                expect.stringContaining("/trade/"), // V2 submit URL
                expect.anything() // traceContext
            );
            // Recipient owners (participantType 2) must not receive submit emails
            const recipientOwnerIds = new Set(
                acceptedTrade.tradeParticipants
                    ?.filter(tp => tp.participantType !== 1)
                    .flatMap(tp => tp.team.owners ?? [])
                    .map(o => o.id)
            );
            for (const ownerId of recipientOwnerIds) {
                expect(mockObanDao.enqueueTradeSubmitEmail).not.toHaveBeenCalledWith(
                    acceptedTrade.id,
                    ownerId,
                    expect.anything(),
                    expect.anything()
                );
            }
            expect(mockObanDao.enqueueTradeSubmitDm).not.toHaveBeenCalled();
            expect(mockEmailPublisher.queueTradeAcceptedMail).not.toHaveBeenCalled();

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
            expect(mockObanDao.enqueueTradeSubmitEmail).toHaveBeenCalledTimes(0);
        });
    });

    describe("notification preference gating", () => {
        const mockRequest = { app: { get: jest.fn() } } as any;
        const fakePrisma = { obanJob: {} } as any;

        function prefsMap(
            ...entries: [string, Partial<OwnerNotificationPrefs>][]
        ): Map<string, OwnerNotificationPrefs> {
            const m = new Map<string, OwnerNotificationPrefs>();
            for (const [id, p] of entries) {
                m.set(id, {
                    discordUserId: p.discordUserId ?? null,
                    discordDmEnabled: p.discordDmEnabled ?? false,
                    emailEnabled: p.emailEnabled ?? true,
                });
            }
            return m;
        }

        beforeEach(() => {
            mockGetPrismaClientFromRequest.mockReturnValue(fakePrisma);
        });

        afterEach(() => {
            mockGetOwnerNotificationPrefs.mockReset();
            mockGetPrismaClientFromRequest.mockReset();
        });

        it("sendRequestTradeMessage: should skip email when emailEnabled=false", async () => {
            const ownerId = requestedTrade.recipients[0]?.owners?.[0]?.id;
            mockGetOwnerNotificationPrefs.mockResolvedValueOnce(
                prefsMap([ownerId!, { emailEnabled: false, discordDmEnabled: false }])
            );
            mockTradeDao.getTradeById.mockResolvedValueOnce(requestedTrade);

            await messengerController.sendRequestTradeMessage(
                requestedTrade.id!,
                mockRes as unknown as Response,
                mockRequest
            );

            const emailCalls = mockObanDao.enqueueTradeRequestEmail.mock.calls.filter((c: any[]) => c[1] === ownerId);
            expect(emailCalls).toHaveLength(0);
        });

        it("sendRequestTradeMessage: should enqueue DM when discordDmEnabled=true", async () => {
            const ownerId = requestedTrade.recipients[0]?.owners?.[0]?.id;
            mockGetOwnerNotificationPrefs.mockResolvedValueOnce(
                prefsMap([ownerId!, { discordDmEnabled: true, discordUserId: "123", emailEnabled: true }])
            );
            mockTradeDao.getTradeById.mockResolvedValueOnce(requestedTrade);

            await messengerController.sendRequestTradeMessage(
                requestedTrade.id!,
                mockRes as unknown as Response,
                mockRequest
            );

            const dmCalls = mockObanDao.enqueueTradeRequestDm.mock.calls.filter((c: any[]) => c[1] === ownerId);
            expect(dmCalls.length).toBeGreaterThanOrEqual(1);
        });

        it("sendRequestTradeMessage: should not enqueue DM when discordDmEnabled=false", async () => {
            const ownerId = requestedTrade.recipients[0]?.owners?.[0]?.id;
            mockGetOwnerNotificationPrefs.mockResolvedValueOnce(
                prefsMap([ownerId!, { discordDmEnabled: false, emailEnabled: true }])
            );
            mockTradeDao.getTradeById.mockResolvedValueOnce(requestedTrade);

            await messengerController.sendRequestTradeMessage(
                requestedTrade.id!,
                mockRes as unknown as Response,
                mockRequest
            );

            expect(mockObanDao.enqueueTradeRequestDm).not.toHaveBeenCalled();
        });

        it("sendTradeDeclineMessage: should skip email when emailEnabled=false", async () => {
            const eligibleOwners =
                declinedTrade.tradeParticipants
                    ?.flatMap(tp => tp.team.owners)
                    .filter(o => o && o.id !== declinedTrade.declinedById) ?? [];
            const entries: [string, Partial<OwnerNotificationPrefs>][] = eligibleOwners.map(o => [
                o!.id!,
                { emailEnabled: false, discordDmEnabled: false },
            ]);
            mockGetOwnerNotificationPrefs.mockResolvedValueOnce(prefsMap(...entries));
            mockTradeDao.getTradeById.mockResolvedValueOnce(declinedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(declinedTrade);

            await messengerController.sendTradeDeclineMessage(
                declinedTrade.id!,
                mockRes as unknown as Response,
                mockRequest
            );

            expect(mockObanDao.enqueueTradeDeclinedEmail).not.toHaveBeenCalled();
        });

        it("sendTradeDeclineMessage: should enqueue DM when discordDmEnabled=true", async () => {
            const eligibleOwners =
                declinedTrade.tradeParticipants
                    ?.flatMap(tp => tp.team.owners)
                    .filter(o => o && o.id !== declinedTrade.declinedById) ?? [];
            const entries: [string, Partial<OwnerNotificationPrefs>][] = eligibleOwners.map(o => [
                o!.id!,
                { emailEnabled: true, discordDmEnabled: true, discordUserId: "999" },
            ]);
            mockGetOwnerNotificationPrefs.mockResolvedValueOnce(prefsMap(...entries));
            mockTradeDao.getTradeById.mockResolvedValueOnce(declinedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(declinedTrade);

            await messengerController.sendTradeDeclineMessage(
                declinedTrade.id!,
                mockRes as unknown as Response,
                mockRequest
            );

            expect(mockObanDao.enqueueTradeDeclinedDm).toHaveBeenCalledTimes(eligibleOwners.length);
        });

        it("sendTradeAcceptanceMessage: should skip email when emailEnabled=false for creator", async () => {
            const creatorOwners = acceptedTrade.creator?.owners ?? [];
            const entries: [string, Partial<OwnerNotificationPrefs>][] = creatorOwners.map(o => [
                o.id!,
                { emailEnabled: false, discordDmEnabled: false },
            ]);
            mockGetOwnerNotificationPrefs.mockResolvedValueOnce(prefsMap(...entries));
            mockTradeDao.getTradeById.mockResolvedValueOnce(acceptedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(acceptedTrade);

            await messengerController.sendTradeAcceptanceMessage(
                acceptedTrade.id!,
                mockRes as unknown as Response,
                mockRequest
            );

            expect(mockObanDao.enqueueTradeSubmitEmail).not.toHaveBeenCalled();
        });

        it("sendTradeAcceptanceMessage: should enqueue DM when discordDmEnabled=true for creator", async () => {
            const creatorOwners = acceptedTrade.creator?.owners ?? [];
            const entries: [string, Partial<OwnerNotificationPrefs>][] = creatorOwners.map(o => [
                o.id!,
                { emailEnabled: true, discordDmEnabled: true, discordUserId: "456" },
            ]);
            mockGetOwnerNotificationPrefs.mockResolvedValueOnce(prefsMap(...entries));
            mockTradeDao.getTradeById.mockResolvedValueOnce(acceptedTrade);
            mockTradeDao.hydrateTrade.mockResolvedValueOnce(acceptedTrade);

            await messengerController.sendTradeAcceptanceMessage(
                acceptedTrade.id!,
                mockRes as unknown as Response,
                mockRequest
            );

            expect(mockObanDao.enqueueTradeSubmitDm).toHaveBeenCalledTimes(creatorOwners.length);
        });
    });
});
