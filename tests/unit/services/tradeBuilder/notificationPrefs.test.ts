import { willNotifyVia } from "../../../../src/services/tradeBuilder/notificationPrefs";
import { v4 as uuid } from "uuid";
import type { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";

// mockDeep<ExtendedPrismaClient["user"]>() triggers a ts-jest internal assertion on the
// deeply overloaded Prisma extended-client type. Use a minimal typed stub instead;
// findUnique is the only method exercised by willNotifyVia.
const mockFindUnique = jest.fn();
const userDb = { findUnique: mockFindUnique } as unknown as ExtendedPrismaClient["user"];

afterEach(() => {
    mockFindUnique.mockClear();
});

function makeUserRow(overrides: { discordUserId?: string | null; userSettings?: Record<string, unknown> | null } = {}) {
    return {
        id: uuid(),
        discordUserId: overrides.discordUserId ?? null,
        userSettings: overrides.userSettings ?? null,
    };
}

describe("unit/ willNotifyVia", () => {
    it("email enabled by default when userSettings is empty", async () => {
        const user = makeUserRow({ userSettings: {} });
        mockFindUnique.mockResolvedValueOnce(user);

        const result = await willNotifyVia(user.id, userDb);

        expect(result.email).toBe(true);
        expect(result.discordDm).toBe(false);
        expect(result.discordUserId).toBeNull();
    });

    it("Discord DM enabled when discordUserId present and setting is true", async () => {
        const user = makeUserRow({
            discordUserId: "1234567890",
            userSettings: { notifications: { tradeActionDiscordDm: true } },
        });
        mockFindUnique.mockResolvedValueOnce(user);

        const result = await willNotifyVia(user.id, userDb);

        expect(result.discordDm).toBe(true);
        expect(result.discordUserId).toBe("1234567890");
    });

    it("Discord DM disabled when setting is explicitly false", async () => {
        const user = makeUserRow({
            discordUserId: "1234",
            userSettings: { notifications: { tradeActionDiscordDm: false } },
        });
        mockFindUnique.mockResolvedValueOnce(user);

        const result = await willNotifyVia(user.id, userDb);

        expect(result.discordDm).toBe(false);
    });

    it("Discord DM false when discordUserId is null even if setting is true", async () => {
        const user = makeUserRow({
            discordUserId: null,
            userSettings: { notifications: { tradeActionDiscordDm: true } },
        });
        mockFindUnique.mockResolvedValueOnce(user);

        const result = await willNotifyVia(user.id, userDb);

        expect(result.discordDm).toBe(false);
        expect(result.discordUserId).toBeNull();
    });

    it("user not found — all channels false", async () => {
        mockFindUnique.mockResolvedValueOnce(null);

        const result = await willNotifyVia(uuid(), userDb);

        expect(result).toEqual({ email: false, discordDm: false, discordUserId: null });
    });

    it("email explicitly disabled via settings", async () => {
        const user = makeUserRow({
            userSettings: { notifications: { tradeActionEmail: false } },
        });
        mockFindUnique.mockResolvedValueOnce(user);

        const result = await willNotifyVia(user.id, userDb);

        expect(result.email).toBe(false);
    });
});
