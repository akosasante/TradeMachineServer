import { getOwnerNotificationPrefs } from "../../../src/utils/userNotificationPrefs";

function makeMockPrisma(rows: any[]) {
    return {
        user: {
            findMany: jest.fn().mockResolvedValue(rows),
        },
    } as any;
}

describe("getOwnerNotificationPrefs", () => {
    it("should return empty map for empty ownerIds", async () => {
        const prisma = makeMockPrisma([]);
        const result = await getOwnerNotificationPrefs(prisma, []);
        expect(result.size).toBe(0);
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("should filter out null, undefined, and empty string ownerIds", async () => {
        const prisma = makeMockPrisma([]);
        const result = await getOwnerNotificationPrefs(prisma, [null, undefined, ""]);
        expect(result.size).toBe(0);
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("should deduplicate ownerIds", async () => {
        const prisma = makeMockPrisma([{ id: "u1", discordUserId: null, userSettings: {} }]);
        await getOwnerNotificationPrefs(prisma, ["u1", "u1", "u1"]);

        expect(prisma.user.findMany).toHaveBeenCalledWith({
            where: { id: { in: ["u1"] } },
            select: { id: true, discordUserId: true, userSettings: true },
        });
    });

    it("should return default prefs (email=true, discordDm=false) for user with empty userSettings", async () => {
        const prisma = makeMockPrisma([{ id: "u1", discordUserId: null, userSettings: {} }]);
        const result = await getOwnerNotificationPrefs(prisma, ["u1"]);

        expect(result.get("u1")).toEqual({
            discordUserId: null,
            discordDmEnabled: false,
            emailEnabled: true,
        });
    });

    it("should return discordDmEnabled=false even when discordUserId exists but tradeActionDiscordDm defaults to false", async () => {
        const prisma = makeMockPrisma([{ id: "u1", discordUserId: "123456789", userSettings: {} }]);
        const result = await getOwnerNotificationPrefs(prisma, ["u1"]);

        expect(result.get("u1")).toEqual({
            discordUserId: "123456789",
            discordDmEnabled: false,
            emailEnabled: true,
        });
    });

    it("should return discordDmEnabled=true when user has discordUserId and tradeActionDiscordDm is true", async () => {
        const prisma = makeMockPrisma([
            {
                id: "u1",
                discordUserId: "123456789",
                userSettings: { notifications: { tradeActionDiscordDm: true, tradeActionEmail: true } },
            },
        ]);
        const result = await getOwnerNotificationPrefs(prisma, ["u1"]);

        expect(result.get("u1")).toEqual({
            discordUserId: "123456789",
            discordDmEnabled: true,
            emailEnabled: true,
        });
    });

    it("should return discordDmEnabled=false when tradeActionDiscordDm is true but no discordUserId", async () => {
        const prisma = makeMockPrisma([
            {
                id: "u1",
                discordUserId: null,
                userSettings: { notifications: { tradeActionDiscordDm: true } },
            },
        ]);
        const result = await getOwnerNotificationPrefs(prisma, ["u1"]);
        expect(result.get("u1")!.discordDmEnabled).toBe(false);
    });

    it("should trim whitespace-only discordUserId to null", async () => {
        const prisma = makeMockPrisma([
            {
                id: "u1",
                discordUserId: "   ",
                userSettings: { notifications: { tradeActionDiscordDm: true } },
            },
        ]);
        const result = await getOwnerNotificationPrefs(prisma, ["u1"]);

        expect(result.get("u1")!.discordUserId).toBeNull();
        expect(result.get("u1")!.discordDmEnabled).toBe(false);
    });

    it("should return emailEnabled=false when tradeActionEmail is explicitly false", async () => {
        const prisma = makeMockPrisma([
            {
                id: "u1",
                discordUserId: "123",
                userSettings: { notifications: { tradeActionEmail: false, tradeActionDiscordDm: true } },
            },
        ]);
        const result = await getOwnerNotificationPrefs(prisma, ["u1"]);

        expect(result.get("u1")!.emailEnabled).toBe(false);
        expect(result.get("u1")!.discordDmEnabled).toBe(true);
    });

    it("should handle multiple users with different settings", async () => {
        const prisma = makeMockPrisma([
            {
                id: "u1",
                discordUserId: "111",
                userSettings: { notifications: { tradeActionDiscordDm: true, tradeActionEmail: false } },
            },
            { id: "u2", discordUserId: null, userSettings: {} },
            { id: "u3", discordUserId: "333", userSettings: null },
        ]);
        const result = await getOwnerNotificationPrefs(prisma, ["u1", "u2", "u3"]);

        expect(result.get("u1")).toEqual({
            discordUserId: "111",
            discordDmEnabled: true,
            emailEnabled: false,
        });
        expect(result.get("u2")).toEqual({
            discordUserId: null,
            discordDmEnabled: false,
            emailEnabled: true,
        });
        expect(result.get("u3")).toEqual({
            discordUserId: "333",
            discordDmEnabled: false,
            emailEnabled: true,
        });
    });

    it("should not include prefs for ownerIds that have no matching DB row", async () => {
        const prisma = makeMockPrisma([{ id: "u1", discordUserId: null, userSettings: {} }]);
        const result = await getOwnerNotificationPrefs(prisma, ["u1", "u-missing"]);

        expect(result.has("u1")).toBe(true);
        expect(result.has("u-missing")).toBe(false);
    });
});
