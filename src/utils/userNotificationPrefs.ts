import { ExtendedPrismaClient } from "../bootstrap/prisma-db";
import { normalizeUserSettings } from "./userSettings";

export interface OwnerNotificationPrefs {
    discordUserId: string | null;
    discordDmEnabled: boolean;
    emailEnabled: boolean;
}

/**
 * For a set of owner IDs, return their resolved notification preferences.
 * Reads `discordUserId` and `userSettings` from the user table, normalizes.
 */
export async function getOwnerNotificationPrefs(
    prisma: ExtendedPrismaClient,
    ownerIds: (string | undefined | null)[]
): Promise<Map<string, OwnerNotificationPrefs>> {
    const unique = [...new Set(ownerIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
    if (unique.length === 0) {
        return new Map();
    }
    const rowsRaw = await prisma.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, discordUserId: true, userSettings: true },
    });
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
    const m = new Map<string, OwnerNotificationPrefs>();
    for (const r of rows) {
        const normalized = normalizeUserSettings(r.userSettings);
        const trimmedDiscord = r.discordUserId?.trim() || null;
        m.set(r.id, {
            discordUserId: trimmedDiscord,
            discordDmEnabled: !!trimmedDiscord && normalized.notifications.tradeActionDiscordDm,
            emailEnabled: normalized.notifications.tradeActionEmail,
        });
    }
    return m;
}
