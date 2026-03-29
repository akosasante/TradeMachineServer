import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { TradeItemType, TradeParticipantType, TradeStatus, UserRole } from "@prisma/client";
import { protectedProcedure, publicProcedure, router, withTracing } from "../utils/trpcHelpers";
import { addSpanAttributes, addSpanEvent } from "../../../../utils/tracing";
import logger from "../../../../bootstrap/logger";
import { tradeActionTokenGeneratedMetric } from "../../../../bootstrap/metrics";
import TradeDAO, { AcceptedByEntry, PrismaTrade } from "../../../../DAO/v2/TradeDAO";
import ObanDAO from "../../../../DAO/v2/ObanDAO";
import { createTradeActionToken } from "../utils/tradeActionTokens";
import { PublicUser } from "../../../../DAO/v2/UserDAO";
import type { ExtendedPrismaClient } from "../../../../bootstrap/prisma-db";

// ─── Validation helpers (adapted from TradeController.ts for Prisma types) ───

/**
 * Resolves the effective user ID for a trade action.
 * Non-admins must use their own session ID.
 * Admins may pass actingAsUserId to act on behalf of another user.
 */
function resolveEffectiveUserId(user: PublicUser, actingAsUserId?: string): string {
    if (actingAsUserId) {
        if (user.role !== UserRole.ADMIN) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Only admins can act on behalf of other users",
            });
        }
        return actingAsUserId;
    }
    return user.id!;
}

function getCreatorOwnerIds(trade: PrismaTrade): string[] {
    return trade.tradeParticipants
        .filter(p => p.participantType === TradeParticipantType.CREATOR)
        .flatMap(p => p.team?.owners?.map(o => o.id) ?? [])
        .filter((id): id is string => !!id);
}

function getRecipientOwnerIds(trade: PrismaTrade): string[] {
    return trade.tradeParticipants
        .filter(p => p.participantType === TradeParticipantType.RECIPIENT)
        .flatMap(p => p.team?.owners?.map(o => o.id) ?? [])
        .filter((id): id is string => !!id);
}

function getAllParticipantOwnerIds(trade: PrismaTrade): string[] {
    return trade.tradeParticipants
        .flatMap(p => p.team?.owners?.map(o => o.id) ?? [])
        .filter((id): id is string => !!id);
}

function isAdmin(user: PublicUser): boolean {
    return user.role === UserRole.ADMIN;
}

function validateOwner(effectiveUserId: string, user: PublicUser, trade: PrismaTrade): boolean {
    if (isAdmin(user)) return true;
    return getCreatorOwnerIds(trade).includes(effectiveUserId);
}

function validateRecipient(effectiveUserId: string, user: PublicUser, trade: PrismaTrade): boolean {
    if (isAdmin(user)) return true;
    return getRecipientOwnerIds(trade).includes(effectiveUserId);
}

function validateParticipant(effectiveUserId: string, user: PublicUser, trade: PrismaTrade): boolean {
    if (isAdmin(user)) return true;
    return getAllParticipantOwnerIds(trade).includes(effectiveUserId);
}

/**
 * Trade status state machine for non-admin participants.
 * Admins always bypass this check.
 */
function validateStatusChange(
    effectiveUserId: string,
    user: PublicUser,
    trade: PrismaTrade,
    newStatus: TradeStatus
): boolean {
    if (trade.status === newStatus) return false;
    if (isAdmin(user) || process.env.ADMIN_OVERRIDE === "true") return true;

    const validChangesForParticipants: Record<TradeStatus, TradeStatus[]> = {
        [TradeStatus.DRAFT]: [],
        [TradeStatus.REQUESTED]: [TradeStatus.PENDING, TradeStatus.ACCEPTED, TradeStatus.REJECTED],
        [TradeStatus.PENDING]: [TradeStatus.ACCEPTED, TradeStatus.REJECTED],
        [TradeStatus.ACCEPTED]: [],
        [TradeStatus.REJECTED]: [],
        [TradeStatus.SUBMITTED]: [],
    };

    const validChangesForOwner: Record<TradeStatus, TradeStatus[]> = {
        ...validChangesForParticipants,
        [TradeStatus.DRAFT]: [TradeStatus.REQUESTED],
        [TradeStatus.ACCEPTED]: [TradeStatus.SUBMITTED],
    };

    const isOwner = validateOwner(effectiveUserId, user, trade);
    const validChanges = isOwner ? validChangesForOwner : validChangesForParticipants;
    return validChanges[trade.status].includes(newStatus);
}

/**
 * Returns true when at least one owner from each recipient team has accepted.
 */
function allRecipientTeamsAccepted(acceptedBy: string[], trade: PrismaTrade): boolean {
    const recipientParticipants = trade.tradeParticipants.filter(
        p => p.participantType === TradeParticipantType.RECIPIENT
    );
    if (recipientParticipants.length === 0) return false;

    return recipientParticipants.every(p => {
        const ownerIds = p.team?.owners?.map(o => o.id).filter((id): id is string => !!id) ?? [];
        return ownerIds.some(id => acceptedBy.includes(id));
    });
}

// ─── Notification helpers ─────────────────────────────────────────────────────

async function enqueueAcceptanceNotifications(
    tradeId: string,
    trade: PrismaTrade,
    obanDb: ExtendedPrismaClient["obanJob"]
): Promise<void> {
    const obanDao = new ObanDAO(obanDb);
    const v3BaseDomain = process.env.V3_BASE_URL;
    const useV3TradeLinks = process.env.USE_V3_TRADE_LINKS === "true";

    const creatorOwners = trade.tradeParticipants
        .filter(p => p.participantType === TradeParticipantType.CREATOR)
        .flatMap(p => p.team?.owners ?? [])
        .filter((o): o is NonNullable<typeof o> => !!o?.id);

    for (const owner of creatorOwners) {
        let submitUrl: string;
        if (useV3TradeLinks && v3BaseDomain) {
            const submitToken = await createTradeActionToken({
                userId: owner.id,
                tradeId,
                action: "submit",
            });
            tradeActionTokenGeneratedMetric.inc({ action: "submit" });
            submitUrl = `${v3BaseDomain}/trades/${tradeId}?action=submit&token=${submitToken}`;
        } else {
            submitUrl = `${process.env.BASE_URL ?? ""}/trade/${tradeId}/submit`;
        }

        await obanDao.enqueueTradeSubmitEmail(tradeId, owner.id, submitUrl);
        logger.info(`[trades.accept] Enqueued submit-prompt email userId=${owner.id} tradeId=${tradeId}`);
    }
}

async function enqueueDeclineNotifications(
    tradeId: string,
    decliningUserId: string,
    trade: PrismaTrade,
    obanDb: ExtendedPrismaClient["obanJob"]
): Promise<void> {
    const obanDao = new ObanDAO(obanDb);
    const v3BaseDomain = process.env.V3_BASE_URL;
    const useV3TradeLinks = process.env.USE_V3_TRADE_LINKS === "true";
    const declineUrl = useV3TradeLinks && v3BaseDomain ? `${v3BaseDomain}/trades/${tradeId}` : undefined;

    const creatorOwnerIdSet = new Set(
        trade.tradeParticipants
            .filter(p => p.participantType === TradeParticipantType.CREATOR)
            .flatMap(p => p.team?.owners?.map(o => o.id) ?? [])
            .filter((id): id is string => !!id)
    );

    const eligibleOwners = trade.tradeParticipants
        .flatMap(p => p.team?.owners ?? [])
        .filter((o): o is NonNullable<typeof o> => !!o?.id && o.id !== decliningUserId);

    for (const owner of eligibleOwners) {
        const isCreator = creatorOwnerIdSet.has(owner.id);
        await obanDao.enqueueTradeDeclinedEmail(tradeId, owner.id, isCreator, declineUrl);
        logger.info(
            `[trades.decline] Enqueued decline email userId=${owner.id} tradeId=${tradeId} isCreator=${isCreator}`
        );
    }
}

// ─── Shared input base ────────────────────────────────────────────────────────

const tradeActionBaseInput = {
    tradeId: z.string().uuid(),
    actingAsUserId: z.string().uuid().optional(),
    skipNotifications: z.boolean().optional().default(false),
};

// ─── Router ──────────────────────────────────────────────────────────────────

/**
 * Loads player or pick entity for each trade item and attaches as `entity`.
 * V3 client expects this shape for TradeSummary (player names, pick labels).
 */
async function hydrateTradeItems(prisma: ExtendedPrismaClient, trade: PrismaTrade): Promise<PrismaTrade> {
    const items = await Promise.all(
        trade.tradeItems.map(async item => {
            let entity: unknown = null;
            if (item.tradeItemType === TradeItemType.PLAYER) {
                entity = await prisma.player.findUnique({ where: { id: item.tradeItemId } });
            } else {
                entity = await prisma.draftPick.findUnique({
                    where: { id: item.tradeItemId },
                    include: { originalOwner: { include: { owners: true } } },
                });
            }
            return { ...item, entity: entity ?? undefined };
        })
    );
    return { ...trade, tradeItems: items } as PrismaTrade;
}

export const tradeRouter = router({
    /**
     * Fetch a trade with all participant/team/owner and item relations.
     * Hydrates each trade item with its player or draft-pick entity for V3 UI.
     * Public so unauthenticated users can load submitted trades (client gates access).
     */
    get: publicProcedure.input(z.object({ tradeId: z.string().uuid() })).query(
        withTracing("trpc.trades.get", async (input, ctx, _span) => {
            addSpanAttributes({ "trades.get.tradeId": input.tradeId });
            addSpanEvent("trades.get.start");

            const dao = new TradeDAO(ctx.prisma.trade);
            let trade: PrismaTrade;
            try {
                trade = await dao.getTradeById(input.tradeId);
            } catch (err: unknown) {
                const e = err as { code?: string; cause?: { code?: string } };
                if (e?.code === "P2025" || e?.cause?.code === "P2025") {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
                }
                throw err;
            }
            const hydrated = await hydrateTradeItems(ctx.prisma, trade);

            addSpanEvent("trades.get.success");
            return hydrated;
        })
    ),

    /**
     * Paginated list of trades for the authenticated user's team.
     * Trade items include sender/recipient teams but are not hydrated with player/pick entities.
     */
    list: protectedProcedure
        .input(
            z.object({
                statuses: z.array(z.nativeEnum(TradeStatus)).optional(),
                page: z.number().int().min(0).default(0),
                pageSize: z.number().int().min(1).max(50).default(20),
            })
        )
        .query(
            withTracing("trpc.trades.list", async (input, ctx, _span) => {
                const user = (ctx as typeof ctx & { user: PublicUser }).user;
                const teamId = user.teamId;
                if (!teamId) {
                    addSpanEvent("trades.list.no_team");
                    return { trades: [] as PrismaTrade[], total: 0, page: input.page, pageSize: input.pageSize };
                }

                addSpanAttributes({ "trades.list.teamId": teamId });
                addSpanEvent("trades.list.start");

                const dao = new TradeDAO(ctx.prisma.trade);
                const { trades, total } = await dao.getTradesByTeam(teamId, {
                    statuses: input.statuses,
                    page: input.page,
                    pageSize: input.pageSize,
                });

                addSpanEvent("trades.list.success");
                return {
                    trades,
                    total,
                    page: input.page,
                    pageSize: input.pageSize,
                };
            })
        ),

    /**
     * Accept a trade on behalf of the current user (or actingAsUserId if admin).
     * Stamps {by, at} into acceptedByDetails and appends the user ID to acceptedBy.
     * If all recipient teams have now accepted, transitions status to ACCEPTED.
     * Returns both the updated trade and an allAccepted flag.
     */
    accept: protectedProcedure.input(z.object(tradeActionBaseInput)).mutation(
        withTracing("trpc.trades.accept", async (input, ctx, _span) => {
            addSpanAttributes({ "trades.accept.tradeId": input.tradeId });
            addSpanEvent("trades.accept.start");

            const user = (ctx as typeof ctx & { user: PublicUser }).user;
            const effectiveUserId = resolveEffectiveUserId(user, input.actingAsUserId);

            addSpanAttributes({
                "trades.accept.effectiveUserId": effectiveUserId,
                "trades.accept.actingAsAdmin": !!input.actingAsUserId,
            });
            if (input.actingAsUserId) {
                addSpanAttributes({ "user.acting_as_id": input.actingAsUserId });
            }

            const dao = new TradeDAO(ctx.prisma.trade);
            const trade = await dao.getTradeById(input.tradeId);

            if (!validateRecipient(effectiveUserId, user, trade)) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Trade can only be accepted by recipients or admins",
                });
            }

            if (!validateStatusChange(effectiveUserId, user, trade, TradeStatus.ACCEPTED)) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Trade with status ${trade.status} cannot be accepted`,
                });
            }

            const existingAcceptedBy = (trade.acceptedBy as string[] | null) ?? [];
            const existingAcceptedByDetails = (trade.acceptedByDetails as AcceptedByEntry[] | null) ?? [];

            if (existingAcceptedBy.includes(effectiveUserId)) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Trade has already been accepted by user ${effectiveUserId}`,
                });
            }

            const newAcceptedBy = [...existingAcceptedBy, effectiveUserId];
            const newAcceptedByDetails: AcceptedByEntry[] = [
                ...existingAcceptedByDetails,
                { by: effectiveUserId, at: new Date().toISOString() },
            ];

            const allAccepted = allRecipientTeamsAccepted(newAcceptedBy, trade);
            const status = allAccepted ? TradeStatus.ACCEPTED : TradeStatus.PENDING;
            const updatedTrade = await dao.updateAcceptedBy(input.tradeId, newAcceptedBy, newAcceptedByDetails, status);

            if (allAccepted && !input.skipNotifications) {
                addSpanEvent("trades.accept.all_accepted");
                await enqueueAcceptanceNotifications(input.tradeId, trade, ctx.prisma.obanJob);
            }

            addSpanEvent("trades.accept.success");
            return { trade: updatedTrade, allAccepted };
        })
    ),

    /**
     * Decline a trade on behalf of the current user (or actingAsUserId if admin).
     * The declining user ID is derived from the session — not accepted from client input.
     */
    decline: protectedProcedure
        .input(
            z.object({
                tradeId: z.string().uuid(),
                declinedReason: z.string().optional(),
                actingAsUserId: z.string().uuid().optional(),
                skipNotifications: z.boolean().optional().default(false),
            })
        )
        .mutation(
            withTracing("trpc.trades.decline", async (input, ctx, _span) => {
                addSpanAttributes({ "trades.decline.tradeId": input.tradeId });
                addSpanEvent("trades.decline.start");

                const user = (ctx as typeof ctx & { user: PublicUser }).user;
                const effectiveUserId = resolveEffectiveUserId(user, input.actingAsUserId);

                addSpanAttributes({ "trades.decline.effectiveUserId": effectiveUserId });
                if (input.actingAsUserId) {
                    addSpanAttributes({ "user.acting_as_id": input.actingAsUserId });
                }

                const dao = new TradeDAO(ctx.prisma.trade);
                const trade = await dao.getTradeById(input.tradeId);

                if (!validateParticipant(effectiveUserId, user, trade)) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "Trade can only be declined by participants or admins",
                    });
                }

                if (!validateStatusChange(effectiveUserId, user, trade, TradeStatus.REJECTED)) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Trade with status ${trade.status} cannot be declined`,
                    });
                }

                const updatedTrade = await dao.updateDeclinedBy(input.tradeId, effectiveUserId, input.declinedReason);

                if (!input.skipNotifications) {
                    await enqueueDeclineNotifications(input.tradeId, effectiveUserId, trade, ctx.prisma.obanJob);
                }

                addSpanEvent("trades.decline.success");
                return updatedTrade;
            })
        ),

    /**
     * Submit a finalized trade to the league on behalf of the creator (or actingAsUserId if admin).
     * Records submittedAt and submittedById, then transitions status to SUBMITTED.
     */
    submit: protectedProcedure.input(z.object(tradeActionBaseInput)).mutation(
        withTracing("trpc.trades.submit", async (input, ctx, _span) => {
            addSpanAttributes({ "trades.submit.tradeId": input.tradeId });
            addSpanEvent("trades.submit.start");

            const user = (ctx as typeof ctx & { user: PublicUser }).user;
            const effectiveUserId = resolveEffectiveUserId(user, input.actingAsUserId);

            addSpanAttributes({ "trades.submit.effectiveUserId": effectiveUserId });
            if (input.actingAsUserId) {
                addSpanAttributes({ "user.acting_as_id": input.actingAsUserId });
            }

            const dao = new TradeDAO(ctx.prisma.trade);
            const trade = await dao.getTradeById(input.tradeId);

            if (!validateOwner(effectiveUserId, user, trade)) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Trade can only be submitted by the trade creator or admins",
                });
            }

            if (!validateStatusChange(effectiveUserId, user, trade, TradeStatus.SUBMITTED)) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Trade with status ${trade.status} cannot be submitted`,
                });
            }

            const updatedTrade = await dao.updateSubmitted(input.tradeId, effectiveUserId);

            if (!input.skipNotifications) {
                const obanDao = new ObanDAO(ctx.prisma.obanJob);
                await obanDao.enqueueTradeAnnouncement(input.tradeId);
                logger.info(`[trades.submit] Enqueued trade announcement tradeId=${input.tradeId}`);
            }

            addSpanEvent("trades.submit.success");
            return updatedTrade;
        })
    ),
});
