import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { protectedProcedure, router, withTracing } from "../utils/trpcHelpers";
import { addSpanAttributes } from "../../../../utils/tracing";
import logger from "../../../../bootstrap/logger";
import { PublicUser } from "../../../../DAO/v2/UserDAO";
import {
    normalizeUserSettings,
    mergeAndValidateNotificationUpdate,
    NotificationSettingsValidationError,
} from "../../../../utils/userSettings";

const notificationUpdateSchema = z.object({
    tradeActionDiscordDm: z.boolean().optional(),
    tradeActionEmail: z.boolean().optional(),
});

export const notificationsRouter = router({
    get: protectedProcedure.query(
        withTracing("trpc.notifications.get", async (_input, ctx, _span) => {
            const user = (ctx as typeof ctx & { user: PublicUser }).user;
            const userId = user.id!;

            addSpanAttributes({ "user.id": userId });

            const dbUser = await ctx.prisma.user.findUniqueOrThrow({
                where: { id: userId },
                select: { userSettings: true },
            });

            const normalized = normalizeUserSettings(dbUser.userSettings);

            return {
                schemaVersion: normalized.schemaVersion,
                settingsUpdatedAt: normalized.settingsUpdatedAt,
                notifications: normalized.notifications,
            };
        })
    ),

    update: protectedProcedure.input(notificationUpdateSchema).mutation(
        withTracing("trpc.notifications.update", async (input, ctx, _span) => {
            const user = (ctx as typeof ctx & { user: PublicUser }).user;
            const userId = user.id!;

            addSpanAttributes({
                "user.id": userId,
                "notifications.patch.discord_dm": input.tradeActionDiscordDm?.toString() ?? "unchanged",
                "notifications.patch.email": input.tradeActionEmail?.toString() ?? "unchanged",
            });

            const dbUser = await ctx.prisma.user.findUniqueOrThrow({
                where: { id: userId },
                select: { userSettings: true },
            });

            let mergedBlob: Prisma.InputJsonValue;
            try {
                mergedBlob = mergeAndValidateNotificationUpdate(
                    dbUser.userSettings, input
                ) as Prisma.InputJsonValue;
            } catch (err) {
                if (err instanceof NotificationSettingsValidationError) {
                    logger.warn(
                        `[notifications.update] Rejected: both channels off for userId=${userId}`
                    );
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: err.message,
                    });
                }
                throw err;
            }

            const updated = await ctx.prisma.user.update({
                where: { id: userId },
                data: {
                    userSettings: mergedBlob,
                    dateModified: new Date(),
                },
                select: { userSettings: true },
            });

            const normalized = normalizeUserSettings(updated.userSettings);

            logger.info(
                `[notifications.update] Updated for userId=${userId}: discord_dm=${normalized.notifications.tradeActionDiscordDm}, email=${normalized.notifications.tradeActionEmail}`
            );

            return {
                schemaVersion: normalized.schemaVersion,
                settingsUpdatedAt: normalized.settingsUpdatedAt,
                notifications: normalized.notifications,
            };
        })
    ),
});
