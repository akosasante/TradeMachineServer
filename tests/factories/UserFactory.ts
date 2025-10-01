import User, { Role } from "../../src/models/user";
import { User as PrismaUser, UserRole } from "@prisma/client";
import { v4 as uuid } from "uuid";

export class UserFactory {
    public static TEST_EMAIL = "test@example+test.com";
    public static GENERIC_PASSWORD = "lol";
    public static ADMIN_EMAIL = "admin@example+test.com";
    public static OWNER_EMAIL = "owner@example+test.com";
    public static GENERIC_NAME = "John Smith";

    public static getUserObject(
        email = UserFactory.TEST_EMAIL,
        displayName = UserFactory.GENERIC_NAME,
        password = UserFactory.GENERIC_PASSWORD,
        role = Role.ADMIN,
        rest = {}
    ): { id: string; email: string; displayName: string; password: string; role: Role } {
        return { id: uuid(), email, displayName, password, role, ...rest };
    }

    public static getPrismaUser(
        email = UserFactory.TEST_EMAIL,
        displayName = UserFactory.GENERIC_NAME,
        password = UserFactory.GENERIC_PASSWORD,
        role = UserRole.ADMIN,
        rest = {}
    ): PrismaUser {
        return {
            id: uuid(),
            email,
            displayName,
            password,
            role,
            dateCreated: new Date(),
            dateModified: new Date(),
            slackUsername: null,
            lastLoggedIn: null,
            passwordResetExpiresOn: null,
            passwordResetToken: null,
            status: "ACTIVE",
            csvName: null,
            espnMember: null,
            teamId: null,
            ...rest,
        };
    }

    public static getUser(
        email = UserFactory.TEST_EMAIL,
        displayName = UserFactory.GENERIC_NAME,
        password = UserFactory.GENERIC_PASSWORD,
        role = Role.ADMIN,
        rest = {}
    ): User {
        return new User(UserFactory.getUserObject(email, displayName, password, role, rest));
    }

    public static getAdminUser(): User {
        return UserFactory.getUser(UserFactory.ADMIN_EMAIL, undefined, undefined, Role.ADMIN);
    }

    public static getOwnerUser(): User {
        return UserFactory.getUser(UserFactory.OWNER_EMAIL, undefined, undefined, Role.OWNER);
    }

    public static getPasswordlessOwner(): User {
        return new User({ email: UserFactory.OWNER_EMAIL, displayName: "Len Mitch", role: Role.OWNER });
    }
}
