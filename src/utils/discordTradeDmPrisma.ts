import { ExtendedPrismaClient } from "../bootstrap/prisma-db";

/**
 * Returns owner id -> trimmed discordUserId for owners that have Discord linked.
 */
export async function mapOwnerIdsToDiscordUserIds(
    prisma: ExtendedPrismaClient,
    ownerIds: (string | undefined | null)[]
): Promise<Map<string, string>> {
    const unique = [...new Set(ownerIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
    if (unique.length === 0) {
        return new Map();
    }
    const rowsRaw = await prisma.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, discordUserId: true },
    });
    const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
    const m = new Map<string, string>();
    for (const r of rows) {
        const d = r.discordUserId?.trim();
        if (d) {
            m.set(r.id, d);
        }
    }
    return m;
}
