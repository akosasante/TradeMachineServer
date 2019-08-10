import User, { Role } from "../../src/models/user";

export class UserFactory {
    public static TEST_EMAIL = "test@example.com";
    public static GENERIC_PASSWORD = "lol";
    public static ADMIN_EMAIL = "admin@example.com";
    public static OWNER_EMAIL = "owner@example.com";

    public static getUserObject(email = UserFactory.TEST_EMAIL, password = UserFactory.GENERIC_PASSWORD,
                                roles = [Role.ADMIN, Role.OWNER], rest = {}) {
        return { email, password, roles , ...rest};
    }

    public static getUser(email = UserFactory.TEST_EMAIL, password = UserFactory.GENERIC_PASSWORD,
                          roles = [Role.ADMIN, Role.OWNER], rest = {}) {
        return new User(UserFactory.getUserObject(email, password, roles, rest));
    }

    public static getAdminUser() {
        return UserFactory.getUser(UserFactory.ADMIN_EMAIL, undefined, [Role.ADMIN]);
    }

    public static getOwnerUser() {
        return UserFactory.getUser(UserFactory.OWNER_EMAIL, undefined, [Role.OWNER]);
    }
}
