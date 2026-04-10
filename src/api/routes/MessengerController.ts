import { BadRequestError, Controller, Param, Post, Req, Res } from "routing-controllers";
import { EmailPublisher } from "../../email/publishers";
import { UUID_PATTERN } from "../helpers/ApiHelpers";
import logger from "../../bootstrap/logger";
import TradeDAO from "../../DAO/TradeDAO";
import ObanDAO from "../../DAO/v2/ObanDAO";
import { Request, Response } from "express";
import { TradeStatus } from "../../models/trade";
import { SlackPublisher } from "../../slack/publishers";
import { rollbar } from "../../bootstrap/rollbar";
import { getPrismaClientFromRequest } from "../../bootstrap/prisma-db";
import { extractTraceContext } from "../../utils/tracing";
import { createTradeActionToken } from "./v2/utils/tradeActionTokens";
import { tradeActionTokenGeneratedMetric, tradeRequestEmailEnqueuedMetric } from "../../bootstrap/metrics";
import { shouldUseV3TradeLinkForEmail } from "../../utils/v3TradeLinkEmailAllowlist";
import { mapOwnerIdsToDiscordUserIds } from "../../utils/discordTradeDmPrisma";
import type { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

const TRADE_REQUEST_OWNER_RELATIONS = ["tradeParticipants", "tradeParticipants.team", "tradeParticipants.team.owners"];

@Controller("/messenger")
export default class MessengerController {
    private emailPublisher: EmailPublisher;
    private slackPublisher: SlackPublisher;
    private tradeDao: TradeDAO;
    private obanDao?: ObanDAO;

    constructor(publisher?: EmailPublisher, tradeDao?: TradeDAO, slackPublisher?: SlackPublisher, obanDao?: ObanDAO) {
        this.emailPublisher = publisher || EmailPublisher.getInstance();
        this.tradeDao = tradeDao || new TradeDAO();
        this.slackPublisher = slackPublisher || SlackPublisher.getInstance();
        this.obanDao = obanDao;
    }

    @Post(`/requestTrade${UUID_PATTERN}`)
    public async sendRequestTradeMessage(
        @Param("id") id: string,
        @Res() response: Response,
        @Req() request?: Request
    ): Promise<Response> {
        rollbar.info("sendRequestTradeMessage", { tradeId: id }, request);
        logger.debug(`queuing trade request email for tradeId: ${id}`);

        const trade = await this.tradeDao.getTradeById(id, TRADE_REQUEST_OWNER_RELATIONS);

        if (trade.status !== TradeStatus.REQUESTED) {
            throw new BadRequestError("Cannot send trade request for this trade based on its status");
        }

        const prisma = getPrismaClientFromRequest(request);
        const obanDao =
            this.obanDao ??
            (() => {
                return prisma ? new ObanDAO(prisma.obanJob) : null;
            })();

        if (!obanDao) {
            logger.warn(`Prisma client not available, cannot enqueue trade request emails for tradeId: ${id}`);
            rollbar.error("Prisma client unavailable for trade request email enqueue", { tradeId: id }, request);
            return response.status(202).json({ status: "trade request queued" });
        }

        const traceContext = extractTraceContext() || undefined;
        const baseDomain = process.env.BASE_URL;
        const v3BaseDomain = process.env.V3_BASE_URL;

        const recipientOwners = trade.recipients.flatMap(recipTeam => recipTeam.owners ?? []);
        const discordByOwner = prisma
            ? await mapOwnerIdsToDiscordUserIds(prisma as ExtendedPrismaClient, recipientOwners.map(o => o.id))
            : new Map<string, string>();

        for (const owner of recipientOwners) {
            if (!owner?.id) continue;

            let acceptUrl: string;
            let declineUrl: string;

            if (shouldUseV3TradeLinkForEmail(owner.email) && v3BaseDomain && trade.id) {
                const [acceptToken, declineToken] = await Promise.all([
                    createTradeActionToken({ userId: owner.id, tradeId: trade.id, action: "accept" }),
                    createTradeActionToken({ userId: owner.id, tradeId: trade.id, action: "decline" }),
                ]);
                tradeActionTokenGeneratedMetric.inc({ action: "accept" });
                tradeActionTokenGeneratedMetric.inc({ action: "decline" });
                acceptUrl = `${v3BaseDomain}/trades/${trade.id}?action=accept&token=${acceptToken}`;
                declineUrl = `${v3BaseDomain}/trades/${trade.id}?action=decline&token=${declineToken}`;
                logger.debug(`[sendRequestTradeMessage] Using V3 magic-link URLs for userId=${owner.id}`);
            } else {
                acceptUrl = `${baseDomain}/trade/${trade.id}/accept`;
                declineUrl = `${baseDomain}/trade/${trade.id}/reject`;
            }

            if (owner.email) {
                await obanDao.enqueueTradeRequestEmail(trade.id!, owner.id!, acceptUrl, declineUrl, traceContext);
                tradeRequestEmailEnqueuedMetric.inc();
                logger.debug(`[sendRequestTradeMessage] Enqueued trade request email for userId=${owner.id}`);
            }

            if (discordByOwner.has(owner.id)) {
                await obanDao.enqueueTradeRequestDm(trade.id!, owner.id, acceptUrl, declineUrl, traceContext);
                logger.debug(`[sendRequestTradeMessage] Enqueued trade request Discord DM job for userId=${owner.id}`);
            }
        }

        return response.status(202).json({ status: "trade request queued" });
    }

    @Post(`/declineTrade${UUID_PATTERN}`)
    public async sendTradeDeclineMessage(
        @Param("id") id: string,
        @Res() response: Response,
        @Req() request?: Request
    ): Promise<Response> {
        rollbar.info("sendTradeDeclineMessage", { tradeId: id }, request);
        logger.debug(`queueing trade declined email for tradeId: ${id}`);
        let trade = await this.tradeDao.getTradeById(id);
        if (trade.status === TradeStatus.REJECTED && trade.declinedById) {
            trade = await this.tradeDao.hydrateTrade(trade);

            const prisma = getPrismaClientFromRequest(request);
            const obanDao =
                this.obanDao ??
                (() => {
                    return prisma ? new ObanDAO(prisma.obanJob) : null;
                })();

            if (!obanDao) {
                logger.warn(`Prisma client not available, cannot enqueue trade declined emails for tradeId: ${id}`);
                rollbar.error("Prisma client unavailable for trade declined email enqueue", { tradeId: id }, request);
                return response.status(202).json({ status: "trade decline email queued" });
            }

            const traceContext = extractTraceContext() || undefined;
            const v3BaseDomain = process.env.V3_BASE_URL;

            const creatorOwnerIds = new Set(trade.creator?.owners?.map(o => o.id).filter(Boolean));
            const eligibleOwners =
                trade.tradeParticipants
                    ?.flatMap(tp => tp.team.owners)
                    .filter(owner => owner && owner.id !== trade.declinedById) ?? [];

            const discordByOwner = prisma
                ? await mapOwnerIdsToDiscordUserIds(prisma as ExtendedPrismaClient, eligibleOwners.map(o => o?.id))
                : new Map<string, string>();

            for (const owner of eligibleOwners) {
                if (!owner?.id) continue;
                const isCreator = creatorOwnerIds.has(owner.id);

                let declineUrl: string | undefined;
                if (shouldUseV3TradeLinkForEmail(owner.email) && v3BaseDomain && trade.id) {
                    const viewToken = await createTradeActionToken({
                        userId: owner.id,
                        tradeId: trade.id,
                        action: "view",
                    });
                    tradeActionTokenGeneratedMetric.inc({ action: "view" });
                    declineUrl = `${v3BaseDomain}/trades/${trade.id}?token=${viewToken}`;
                    logger.debug(`[sendTradeDeclineMessage] Using V3 view-token URL for userId=${owner.id}`);
                }

                if (owner.email) {
                    await obanDao.enqueueTradeDeclinedEmail(trade.id!, owner.id, isCreator, declineUrl, traceContext);
                    logger.debug(
                        `[sendTradeDeclineMessage] Enqueued trade declined email for userId=${owner.id}, isCreator=${isCreator}`
                    );
                }

                if (discordByOwner.has(owner.id)) {
                    await obanDao.enqueueTradeDeclinedDm(trade.id!, owner.id, isCreator, declineUrl, traceContext);
                    logger.debug(
                        `[sendTradeDeclineMessage] Enqueued trade declined Discord DM job for userId=${owner.id}, isCreator=${isCreator}`
                    );
                }
            }

            return response.status(202).json({ status: "trade decline email queued" });
        } else {
            throw new BadRequestError("Cannot send trade decline email for this trade based on its status");
        }
    }

    @Post(`/acceptTrade${UUID_PATTERN}`)
    public async sendTradeAcceptanceMessage(
        @Param("id") id: string,
        @Res() response: Response,
        @Req() request?: Request
    ): Promise<Response> {
        rollbar.info("sendTradeAcceptanceMessage", { tradeId: id }, request);
        logger.debug(`queueing trade acceptance email for tradeId: ${id}`);
        let trade = await this.tradeDao.getTradeById(id);
        if (trade.status === TradeStatus.ACCEPTED) {
            trade = await this.tradeDao.hydrateTrade(trade);

            const prisma = getPrismaClientFromRequest(request);
            const obanDao =
                this.obanDao ??
                (() => {
                    return prisma ? new ObanDAO(prisma.obanJob) : null;
                })();

            if (!obanDao) {
                logger.warn(`Prisma client not available, cannot enqueue trade submit emails for tradeId: ${id}`);
                rollbar.error("Prisma client unavailable for trade submit email enqueue", { tradeId: id }, request);
                return response.status(202).json({ status: "trade acceptance email queued" });
            }

            const traceContext = extractTraceContext() || undefined;
            const baseDomain = process.env.BASE_URL;
            const v3BaseDomain = process.env.V3_BASE_URL;

            const creatorOwners = trade.creator?.owners ?? [];
            const discordByOwner = prisma
                ? await mapOwnerIdsToDiscordUserIds(prisma as ExtendedPrismaClient, creatorOwners.map(o => o?.id))
                : new Map<string, string>();

            for (const owner of creatorOwners) {
                if (!owner?.id) continue;

                let submitUrl: string;
                if (shouldUseV3TradeLinkForEmail(owner.email) && v3BaseDomain && trade.id) {
                    const submitToken = await createTradeActionToken({
                        userId: owner.id,
                        tradeId: trade.id,
                        action: "submit",
                    });
                    tradeActionTokenGeneratedMetric.inc({ action: "submit" });
                    submitUrl = `${v3BaseDomain}/trades/${trade.id}?action=submit&token=${submitToken}`;
                    logger.debug(`[sendTradeAcceptanceMessage] Using V3 magic-link URL for userId=${owner.id}`);
                } else {
                    submitUrl = `${baseDomain}/trade/${trade.id}/submit`;
                }

                if (owner.email) {
                    await obanDao.enqueueTradeSubmitEmail(trade.id!, owner.id, submitUrl, traceContext);
                    logger.debug(`[sendTradeAcceptanceMessage] Enqueued trade submit email for userId=${owner.id}`);
                }

                if (discordByOwner.has(owner.id)) {
                    await obanDao.enqueueTradeSubmitDm(trade.id!, owner.id, submitUrl, traceContext);
                    logger.debug(`[sendTradeAcceptanceMessage] Enqueued trade submit Discord DM job for userId=${owner.id}`);
                }
            }

            return response.status(202).json({ status: "trade acceptance email queued" });
        } else {
            throw new BadRequestError("Cannot send trade acceptance email for this trade based on its status");
        }
    }

    @Post(`/submitTrade${UUID_PATTERN}`)
    public async sendTradeAnnouncementMessage(
        @Param("id") id: string,
        @Res() response: Response,
        @Req() request?: Request
    ): Promise<Response> {
        logger.debug(`queuing trade announcement slack message for tradeId: ${id}`);
        rollbar.info("sendTradeAnnouncementMessage", { tradeId: id }, request);
        let trade = await this.tradeDao.getTradeById(id);
        if (trade.status === TradeStatus.SUBMITTED) {
            trade = await this.tradeDao.hydrateTrade(trade);
            await this.slackPublisher.queueTradeAnnouncement(trade);

            try {
                const prisma = getPrismaClientFromRequest(request);
                if (prisma) {
                    const obanDao = new ObanDAO(prisma.obanJob);
                    const traceContext = extractTraceContext() || undefined;
                    await obanDao.enqueueTradeAnnouncement(id, traceContext);
                    logger.info(`Discord trade announcement job enqueued for tradeId: ${id}`);
                } else {
                    logger.warn(`Prisma client not available, skipping Discord announcement for tradeId: ${id}`);
                }
            } catch (err) {
                logger.error(`Failed to enqueue Discord trade announcement for tradeId: ${id}`, err);
                rollbar.error("Failed to enqueue Discord trade announcement", err as Error, request);
            }

            return response.status(202).json({ status: "accepted trade announcement queued" });
        } else {
            throw new BadRequestError("Cannot send trade announcement for this trade based on its status");
        }
    }
}
