import { PrismaClient, User } from "@prisma/client";
import logger from "../../../../src/bootstrap/logger";
import { mockClear, mockDeep } from "jest-mock-extended";
import type { User as UserDO } from "../../../../src/DAO/v2/UserDAO";
import UserDAO from "../../../../src/DAO/v2/UserDAO";
import { UserFactory } from "../../../factories/UserFactory";
import { ExtendedPrismaClient } from "../../../../src/bootstrap/prisma-db";

describe("[PRISMA] UserDAO", () => {
    const testUser: User = UserFactory.getPrismaUser();
    const prisma = mockDeep<PrismaClient["user"]>();
    const Users: UserDAO = new UserDAO(prisma as unknown as ExtendedPrismaClient["user"]);

    afterEach(() => {
        mockClear(prisma);
    });

    beforeAll(() => {
        logger.debug("~~~~~~PRISMA USER DAO TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~PRISMA USER DAO TESTS COMPLETE~~~~~~");
    });

    describe("getAllUsers", () => {
        it("should return an array of public users by calling the db", async () => {
            prisma.findMany.mockResolvedValueOnce([testUser]);
            const publicUser = UserDAO.publicUser(testUser as unknown as UserDO);
            const sortOptions = { orderBy: { id: "asc" } };

            const res = await Users.getAllUsers();

            expect(prisma.findMany).toHaveBeenCalledTimes(1);
            expect(prisma.findMany).toHaveBeenCalledWith(sortOptions);
            expect(res).toEqual([publicUser]);
        });
    });

    describe("findUserWithPasswordByEmail", () => {
        it("should return user with password when user exists", async () => {
            const email = "test@example.com";
            prisma.findUnique.mockResolvedValueOnce(testUser);

            const res = await Users.findUserWithPasswordByEmail(email);

            expect(prisma.findUnique).toHaveBeenCalledTimes(1);
            expect(prisma.findUnique).toHaveBeenCalledWith({
                where: { email },
                select: {
                    id: true,
                    email: true,
                    password: true,
                    role: true,
                    status: true,
                    lastLoggedIn: true,
                    passwordResetToken: true,
                    passwordResetExpiresOn: true,
                },
            });
            expect(res).toEqual(testUser);
        });

        it("should return null when user doesn't exist", async () => {
            const email = "nonexistent@example.com";
            prisma.findUnique.mockResolvedValueOnce(null);

            const res = await Users.findUserWithPasswordByEmail(email);

            expect(prisma.findUnique).toHaveBeenCalledTimes(1);
            expect(res).toBeNull();
        });
    });

    describe("findUserByPasswordResetToken", () => {
        it("should return public user when token matches", async () => {
            const token = "test-token-123";
            prisma.findFirst.mockResolvedValueOnce(testUser);
            const publicUser = UserDAO.publicUser(testUser as unknown as UserDO);

            const res = await Users.findUserByPasswordResetToken(token);

            expect(prisma.findFirst).toHaveBeenCalledTimes(1);
            expect(prisma.findFirst).toHaveBeenCalledWith({
                where: { passwordResetToken: token },
            });
            expect(res).toEqual(publicUser);
        });

        it("should return null when token doesn't match", async () => {
            const token = "invalid-token";
            prisma.findFirst.mockResolvedValueOnce(null);

            const res = await Users.findUserByPasswordResetToken(token);

            expect(prisma.findFirst).toHaveBeenCalledTimes(1);
            expect(res).toBeNull();
        });
    });

    describe("createUsers", () => {
        it("should create multiple users with default values and return public users", async () => {
            const userObjs = [
                { email: "user1@example.com", displayName: "User 1" },
                { email: "user2@example.com", displayName: "User 2", espnMember: "espn123" },
            ];
            const createdUsers = [
                UserFactory.getPrismaUser("user1@example.com", "User 1"),
                UserFactory.getPrismaUser("user2@example.com", "User 2"),
            ];

            prisma.createMany.mockResolvedValueOnce({ count: 2 });
            prisma.findMany.mockResolvedValueOnce(createdUsers);

            const res = await Users.createUsers(userObjs);

            expect(prisma.createMany).toHaveBeenCalledTimes(1);
            expect(prisma.createMany).toHaveBeenCalledWith({
                data: [
                    { email: "user1@example.com", displayName: "User 1", espnMember: undefined },
                    { email: "user2@example.com", displayName: "User 2", espnMember: "espn123" },
                ],
                skipDuplicates: true,
            });
            expect(prisma.findMany).toHaveBeenCalledTimes(1);
            expect(prisma.findMany).toHaveBeenCalledWith({
                where: { email: { in: ["user1@example.com", "user2@example.com"] } },
            });
            expect(res).toEqual(UserDAO.publicUsers(createdUsers as unknown as UserDO[]));
        });
    });

    describe("setPasswordExpires", () => {
        it("should generate token, set expiration 1 hour in future, and return public user", async () => {
            const userId = "test-user-id";
            const beforeCall = Date.now();

            prisma.update.mockResolvedValueOnce(testUser);

            const res = await Users.setPasswordExpires(userId);

            const afterCall = Date.now();

            expect(prisma.update).toHaveBeenCalledTimes(1);
            const updateCall = prisma.update.mock.calls[0][0];
            expect(updateCall.where).toEqual({ id: userId });

            // Verify token is 40-character hex string
            const { passwordResetToken, passwordResetExpiresOn } = updateCall.data as {
                passwordResetToken: string;
                passwordResetExpiresOn: Date;
            };
            expect(passwordResetToken).toMatch(/^[0-9a-f]{40}$/);

            // Verify expiration is approximately 1 hour in future (within 5 second window)
            const expectedExpiration = beforeCall + 60 * 60 * 1000;
            const expirationTimestamp = passwordResetExpiresOn.getTime();
            expect(expirationTimestamp).toBeGreaterThanOrEqual(expectedExpiration);
            expect(expirationTimestamp).toBeLessThanOrEqual(afterCall + 60 * 60 * 1000);

            expect(res).toEqual(UserDAO.publicUser(testUser as unknown as UserDO));
        });
    });
});
