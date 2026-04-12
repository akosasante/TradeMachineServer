import { mockDeep, mockClear } from "jest-mock-extended";
import UserDAO, { PublicUser } from "../../../../src/DAO/v2/UserDAO";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";
import logger from "../../../../src/bootstrap/logger";
import { v4 as uuid } from "uuid";
import { UserRole, UserStatus } from "@prisma/client";

const makeUser = (overrides: Record<string, unknown> = {}) => ({
    id: uuid(),
    email: "test@example.com",
    displayName: "Test User",
    password: "hashed-secret",
    role: UserRole.OWNER,
    status: UserStatus.ACTIVE,
    slackUsername: null,
    discordUserId: null,
    teamId: null,
    espnMember: null,
    lastLoggedIn: null,
    dateCreated: new Date(),
    dateModified: new Date(),
    passwordResetToken: null,
    passwordResetExpiresOn: null,
    csvName: null,
    userSettings: null,
    ...overrides,
});

describe("[PRISMA] UserDAO", () => {
    const prisma = mockDeep<ExtendedPrismaClient["user"]>();
    const dao = new UserDAO(prisma as unknown as ExtendedPrismaClient["user"]);

    beforeAll(() => {
        logger.debug("~~~~~~PRISMA USER DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PRISMA USER DAO TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        mockClear(prisma);
    });

    describe("constructor", () => {
        it("should throw when initialized without a prisma client", () => {
            expect(() => new UserDAO(undefined)).toThrow(
                "UserDAO must be initialized with a PrismaClient model instance!"
            );
        });
    });

    describe("publicUser / publicUsers", () => {
        it("should strip the password field from a user", () => {
            const user = makeUser();
            const result = UserDAO.publicUser(user as any);
            expect(result).not.toHaveProperty("password");
            expect(result.id).toBe(user.id);
            expect(result.email).toBe(user.email);
        });

        it("should strip password from an array of users", () => {
            const users = [makeUser(), makeUser({ email: "other@example.com" })];
            const result = UserDAO.publicUsers(users as any);
            expect(result).toHaveLength(2);
            result.forEach(u => expect(u).not.toHaveProperty("password"));
        });
    });

    describe("getAllUsers", () => {
        it("should return all users ordered by id, without passwords", async () => {
            const users = [makeUser(), makeUser({ email: "b@b.com" })];
            prisma.findMany.mockResolvedValueOnce(users as any);

            const result = await dao.getAllUsers();

            expect(prisma.findMany).toHaveBeenCalledWith({ orderBy: { id: "asc" } });
            expect(result).toHaveLength(2);
            result.forEach(u => expect(u).not.toHaveProperty("password"));
        });
    });

    describe("getUserById", () => {
        it("should find a user by id and strip password", async () => {
            const user = makeUser();
            prisma.findUniqueOrThrow.mockResolvedValueOnce(user as any);

            const result = await dao.getUserById(user.id);

            expect(prisma.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: user.id } });
            expect(result).not.toHaveProperty("password");
            expect(result.id).toBe(user.id);
        });
    });

    describe("findUserWithPasswordByEmail", () => {
        it("should return the user with password when found", async () => {
            const user = makeUser();
            prisma.findUnique.mockResolvedValueOnce(user as any);

            const result = await dao.findUserWithPasswordByEmail(user.email);

            expect(prisma.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { email: user.email } })
            );
            expect(result).toEqual(user);
        });

        it("should return null when user is not found", async () => {
            prisma.findUnique.mockResolvedValueOnce(null);

            const result = await dao.findUserWithPasswordByEmail("nonexistent@example.com");

            expect(result).toBeNull();
        });
    });

    describe("findUserByPasswordResetToken", () => {
        it("should return public user when token matches", async () => {
            const user = makeUser({ passwordResetToken: "token-abc" });
            prisma.findFirst.mockResolvedValueOnce(user as any);

            const result = await dao.findUserByPasswordResetToken("token-abc");

            expect(prisma.findFirst).toHaveBeenCalledWith({ where: { passwordResetToken: "token-abc" } });
            expect(result).not.toHaveProperty("password");
            expect(result!.id).toBe(user.id);
        });

        it("should return null when no user matches the token", async () => {
            prisma.findFirst.mockResolvedValueOnce(null);

            const result = await dao.findUserByPasswordResetToken("invalid-token");

            expect(result).toBeNull();
        });
    });

    describe("createUsers", () => {
        it("should createMany with skipDuplicates and return public users", async () => {
            const input = [{ email: "new@example.com" }, { email: "new2@example.com" }];
            const created = input.map(i => makeUser(i));
            prisma.createMany.mockResolvedValueOnce({ count: 2 } as any);
            prisma.findMany.mockResolvedValueOnce(created as any);

            const result = await dao.createUsers(input as any);

            expect(prisma.createMany).toHaveBeenCalledWith(
                expect.objectContaining({ skipDuplicates: true })
            );
            expect(prisma.findMany).toHaveBeenCalledWith({
                where: { email: { in: ["new@example.com", "new2@example.com"] } },
            });
            expect(result).toHaveLength(2);
            result.forEach(u => expect(u).not.toHaveProperty("password"));
        });
    });

    describe("getAllUsersWithTeams", () => {
        it("should include team relation with selected fields", async () => {
            const users = [makeUser()];
            prisma.findMany.mockResolvedValueOnce(users as any);

            await dao.getAllUsersWithTeams();

            expect(prisma.findMany).toHaveBeenCalledWith({
                orderBy: { id: "asc" },
                include: { team: { select: { id: true, name: true } } },
            });
        });
    });

    describe("deleteUser", () => {
        it("should delete user by id and return public user", async () => {
            const user = makeUser();
            prisma.delete.mockResolvedValueOnce(user as any);

            const result = await dao.deleteUser(user.id);

            expect(prisma.delete).toHaveBeenCalledWith({ where: { id: user.id } });
            expect(result).not.toHaveProperty("password");
        });
    });

    describe("updateUser", () => {
        it("should update user fields and return public user", async () => {
            const user = makeUser({ displayName: "Updated" });
            prisma.update.mockResolvedValueOnce(user as any);

            const result = await dao.updateUser(user.id, { displayName: "Updated" } as any);

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: user.id },
                data: { displayName: "Updated" },
            });
            expect(result).not.toHaveProperty("password");
            expect(result.displayName).toBe("Updated");
        });
    });

    describe("setPasswordExpires", () => {
        it("should set a reset token and expiry on the user", async () => {
            const user = makeUser();
            prisma.update.mockResolvedValueOnce(user as any);

            const result = await dao.setPasswordExpires(user.id);

            expect(prisma.update).toHaveBeenCalledWith({
                where: { id: user.id },
                data: expect.objectContaining({
                    passwordResetExpiresOn: expect.any(Date),
                    passwordResetToken: expect.any(String),
                }),
            });
            expect(result).not.toHaveProperty("password");
        });

        it("should set expiry roughly 1 hour in the future", async () => {
            const user = makeUser();
            prisma.update.mockResolvedValueOnce(user as any);
            const before = Date.now();

            await dao.setPasswordExpires(user.id);

            const call = prisma.update.mock.calls[0][0];
            const expiresOn = (call.data as any).passwordResetExpiresOn as Date;
            const after = Date.now();
            const oneHourMs = 60 * 60 * 1000;
            expect(expiresOn.getTime()).toBeGreaterThanOrEqual(before + oneHourMs - 100);
            expect(expiresOn.getTime()).toBeLessThanOrEqual(after + oneHourMs + 100);
        });
    });
});
