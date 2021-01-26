import User, { Role } from "../../src/models/user";
import { v4 as uuid } from "uuid";

export class UserFactory {
    public static TEST_EMAIL = "test@example.com";
    public static GENERIC_PASSWORD = "lol";
    public static ADMIN_EMAIL = "admin@example+test.com";
    public static OWNER_EMAIL = "owner@example+test.com";
    public static GENERIC_NAME = "John Smith";

    public static getUserObject(email = UserFactory.TEST_EMAIL, displayName = UserFactory.GENERIC_NAME,
                                password = UserFactory.GENERIC_PASSWORD, role = Role.ADMIN, rest = {}) {
        return { id: uuid(), email, displayName, password, role , ...rest};
    }

    public static getUser(email = UserFactory.TEST_EMAIL, displayName = UserFactory.GENERIC_NAME,
                          password = UserFactory.GENERIC_PASSWORD, role = Role.ADMIN, rest = {}) {
        return new User(UserFactory.getUserObject(email, displayName, password, role, rest));
    }

    public static getAdminUser() {
        return UserFactory.getUser(UserFactory.ADMIN_EMAIL, undefined, undefined, Role.ADMIN);
    }

    public static getOwnerUser() {
        return UserFactory.getUser(UserFactory.OWNER_EMAIL, undefined, undefined, Role.OWNER);
    }

    public static getPasswordlessOwner() {
        return new User({email: UserFactory.OWNER_EMAIL, displayName: "Len Mitch", role: Role.OWNER});
    }
}
