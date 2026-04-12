import { z } from "zod";

/**
 * JSONB shape for `user.userSettings`. See docs/adr/0001-user-settings-jsonb-on-user.md.
 *
 * Schema version 1: notification preferences for trade workflow.
 */

const CURRENT_SCHEMA_VERSION = 1;

const notificationsSchema = z.object({
    tradeActionDiscordDm: z.boolean().nullable().optional(),
    tradeActionEmail: z.boolean().nullable().optional(),
}).optional().nullable();

export const userSettingsSchema = z.object({
    schemaVersion: z.number().int().nullable().optional(),
    settingsUpdatedAt: z.string().nullable().optional(),
    notifications: notificationsSchema,
}).nullable().optional();

export type UserSettingsRaw = z.infer<typeof userSettingsSchema>;

export interface ResolvedNotifications {
    tradeActionDiscordDm: boolean;
    tradeActionEmail: boolean;
}

export interface NormalizedUserSettings {
    schemaVersion: number;
    settingsUpdatedAt: string | null;
    notifications: ResolvedNotifications;
}

const DEFAULT_TRADE_ACTION_EMAIL = true;
const DEFAULT_TRADE_ACTION_DISCORD_DM = false;

/**
 * Normalize a raw `userSettings` JSONB value into resolved booleans.
 * Handles null, undefined, empty `{}`, missing keys, and JSON null values.
 */
export function normalizeUserSettings(raw: unknown): NormalizedUserSettings {
    if (raw == null || (typeof raw === "object" && Object.keys(raw as object).length === 0)) {
        return {
            schemaVersion: CURRENT_SCHEMA_VERSION,
            settingsUpdatedAt: null,
            notifications: {
                tradeActionDiscordDm: DEFAULT_TRADE_ACTION_DISCORD_DM,
                tradeActionEmail: DEFAULT_TRADE_ACTION_EMAIL,
            },
        };
    }

    const parsed = userSettingsSchema.safeParse(raw);
    const data = parsed.success ? parsed.data : null;

    const notifications = data?.notifications;

    return {
        schemaVersion: data?.schemaVersion ?? CURRENT_SCHEMA_VERSION,
        settingsUpdatedAt: data?.settingsUpdatedAt ?? null,
        notifications: {
            tradeActionDiscordDm: notifications?.tradeActionDiscordDm ?? DEFAULT_TRADE_ACTION_DISCORD_DM,
            tradeActionEmail: notifications?.tradeActionEmail ?? DEFAULT_TRADE_ACTION_EMAIL,
        },
    };
}

export class NotificationSettingsValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotificationSettingsValidationError";
    }
}

/**
 * Validate that at least one trade notification channel is enabled.
 * Throws `NotificationSettingsValidationError` if both are off.
 */
export function validateNotificationInvariant(resolved: ResolvedNotifications): void {
    if (!resolved.tradeActionDiscordDm && !resolved.tradeActionEmail) {
        throw new NotificationSettingsValidationError(
            "At least one trade notification channel must be enabled (Discord DMs or trade emails)."
        );
    }
}

export interface NotificationPatchInput {
    tradeActionDiscordDm?: boolean;
    tradeActionEmail?: boolean;
}

/**
 * Merge a partial notification update into the existing raw settings blob,
 * normalize, validate, stamp `settingsUpdatedAt`, and return the full blob
 * ready for Prisma `user.update({ data: { userSettings: result } })`.
 */
export function mergeAndValidateNotificationUpdate(
    existingRaw: unknown,
    patch: NotificationPatchInput
): Record<string, unknown> {
    const existing = normalizeUserSettings(existingRaw);

    const merged: ResolvedNotifications = {
        tradeActionDiscordDm: patch.tradeActionDiscordDm ?? existing.notifications.tradeActionDiscordDm,
        tradeActionEmail: patch.tradeActionEmail ?? existing.notifications.tradeActionEmail,
    };

    validateNotificationInvariant(merged);

    const raw = (existingRaw != null && typeof existingRaw === "object") ? { ...(existingRaw as Record<string, unknown>) } : {};

    return {
        ...raw,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settingsUpdatedAt: new Date().toISOString(),
        notifications: {
            ...((raw.notifications && typeof raw.notifications === "object") ? raw.notifications : {}),
            tradeActionDiscordDm: merged.tradeActionDiscordDm,
            tradeActionEmail: merged.tradeActionEmail,
        },
    };
}

export { CURRENT_SCHEMA_VERSION };
