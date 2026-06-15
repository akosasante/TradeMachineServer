import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";
import { normalizeUserSettings } from "../../utils/userSettings";

export interface NotificationChannels {
    email: boolean;
    discordDm: boolean;
    discordUserId: string | null;
}

/**
 * Resolves notification channel preferences for a single user.
 * Accepts a Prisma user delegate so callers can pass their existing db handle
 * without needing a full PrismaClient instance.
 */
export async function willNotifyVia(
    userId: string,
    userDb: ExtendedPrismaClient["user"]
): Promise<NotificationChannels> {
    const row = await userDb.findUnique({
        where: { id: userId },
        select: { id: true, discordUserId: true, userSettings: true },
    });

    if (!row) {
        return { email: false, discordDm: false, discordUserId: null };
    }

    const normalized = normalizeUserSettings(row.userSettings);
    const trimmedDiscord = row.discordUserId?.trim() || null;

    return {
        email: normalized.notifications.tradeActionEmail,
        discordDm: !!trimmedDiscord && normalized.notifications.tradeActionDiscordDm,
        discordUserId: trimmedDiscord,
    };
}
