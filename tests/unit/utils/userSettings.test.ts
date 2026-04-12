import {
    normalizeUserSettings,
    validateNotificationInvariant,
    mergeAndValidateNotificationUpdate,
    NotificationSettingsValidationError,
} from "../../../src/utils/userSettings";

describe("normalizeUserSettings", () => {
    it("returns defaults for null", () => {
        const result = normalizeUserSettings(null);
        expect(result.notifications.tradeActionEmail).toBe(true);
        expect(result.notifications.tradeActionDiscordDm).toBe(false);
        expect(result.settingsUpdatedAt).toBeNull();
        expect(result.schemaVersion).toBe(1);
    });

    it("returns defaults for undefined", () => {
        const result = normalizeUserSettings(undefined);
        expect(result.notifications.tradeActionEmail).toBe(true);
        expect(result.notifications.tradeActionDiscordDm).toBe(false);
    });

    it("returns defaults for empty object", () => {
        const result = normalizeUserSettings({});
        expect(result.notifications.tradeActionEmail).toBe(true);
        expect(result.notifications.tradeActionDiscordDm).toBe(false);
    });

    it("returns defaults for empty notifications", () => {
        const result = normalizeUserSettings({ notifications: {} });
        expect(result.notifications.tradeActionEmail).toBe(true);
        expect(result.notifications.tradeActionDiscordDm).toBe(false);
    });

    it("respects explicit false for email", () => {
        const result = normalizeUserSettings({
            notifications: { tradeActionEmail: false },
        });
        expect(result.notifications.tradeActionEmail).toBe(false);
        expect(result.notifications.tradeActionDiscordDm).toBe(false);
    });

    it("respects explicit true for Discord DM", () => {
        const result = normalizeUserSettings({
            notifications: { tradeActionDiscordDm: true },
        });
        expect(result.notifications.tradeActionDiscordDm).toBe(true);
        expect(result.notifications.tradeActionEmail).toBe(true);
    });

    it("preserves settingsUpdatedAt when present", () => {
        const ts = "2026-04-12T01:00:00.000Z";
        const result = normalizeUserSettings({ settingsUpdatedAt: ts });
        expect(result.settingsUpdatedAt).toBe(ts);
    });

    it("preserves schemaVersion when present", () => {
        const result = normalizeUserSettings({ schemaVersion: 2 });
        expect(result.schemaVersion).toBe(2);
    });

    it("handles JSON null values for notification keys as defaults", () => {
        const result = normalizeUserSettings({
            notifications: { tradeActionDiscordDm: null, tradeActionEmail: null },
        });
        expect(result.notifications.tradeActionDiscordDm).toBe(false);
        expect(result.notifications.tradeActionEmail).toBe(true);
    });

    it("handles garbage input gracefully (falls back to defaults)", () => {
        const result = normalizeUserSettings("not an object");
        expect(result.notifications.tradeActionEmail).toBe(true);
        expect(result.notifications.tradeActionDiscordDm).toBe(false);
    });
});

describe("validateNotificationInvariant", () => {
    it("does not throw when email is on", () => {
        expect(() =>
            validateNotificationInvariant({ tradeActionDiscordDm: false, tradeActionEmail: true })
        ).not.toThrow();
    });

    it("does not throw when Discord is on", () => {
        expect(() =>
            validateNotificationInvariant({ tradeActionDiscordDm: true, tradeActionEmail: false })
        ).not.toThrow();
    });

    it("does not throw when both are on", () => {
        expect(() =>
            validateNotificationInvariant({ tradeActionDiscordDm: true, tradeActionEmail: true })
        ).not.toThrow();
    });

    it("throws when both are off", () => {
        expect(() => validateNotificationInvariant({ tradeActionDiscordDm: false, tradeActionEmail: false })).toThrow(
            NotificationSettingsValidationError
        );
    });
});

describe("mergeAndValidateNotificationUpdate", () => {
    it("patches a single key onto empty blob", () => {
        const result = mergeAndValidateNotificationUpdate({}, { tradeActionDiscordDm: true });
        expect(result.notifications).toEqual({
            tradeActionDiscordDm: true,
            tradeActionEmail: true,
        });
        expect(result.schemaVersion).toBe(1);
        expect(typeof result.settingsUpdatedAt).toBe("string");
    });

    it("patches a single key onto existing blob", () => {
        const existing = {
            schemaVersion: 1,
            settingsUpdatedAt: "2026-01-01T00:00:00.000Z",
            notifications: { tradeActionDiscordDm: true, tradeActionEmail: true },
        };
        const result = mergeAndValidateNotificationUpdate(existing, { tradeActionEmail: false });
        expect(result.notifications).toEqual({
            tradeActionDiscordDm: true,
            tradeActionEmail: false,
        });
        expect(result.settingsUpdatedAt).not.toBe("2026-01-01T00:00:00.000Z");
    });

    it("rejects both-off after merge", () => {
        const existing = {
            notifications: { tradeActionDiscordDm: false, tradeActionEmail: true },
        };
        expect(() => mergeAndValidateNotificationUpdate(existing, { tradeActionEmail: false })).toThrow(
            NotificationSettingsValidationError
        );
    });

    it("preserves extra keys in the blob", () => {
        const existing = { schemaVersion: 1, someOtherSetting: "keep me" };
        const result = mergeAndValidateNotificationUpdate(existing, { tradeActionDiscordDm: true });
        expect((result as Record<string, unknown>).someOtherSetting).toBe("keep me");
    });
});
