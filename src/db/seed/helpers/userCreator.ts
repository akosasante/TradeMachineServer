import { faker } from "@faker-js/faker";
import UserDAO from "../../../DAO/UserDAO";
import User, { Role, UserStatus } from "../../../models/user";
import { randomUUID } from "crypto";

let dao: UserDAO | null;

async function init() {
    if (!dao) {
        dao = new UserDAO();
    }
    return dao;
}

export function createGenericUser() {
    const slackUsername = faker.internet.userName();
    const email = faker.internet.exampleEmail();
    const displayName = faker.name.fullName();
    return new User({ id: randomUUID(), slackUsername, email, displayName, role: Role.OWNER });
}

export function createAdminUser() {
    const user = createGenericUser();
    user.role = Role.ADMIN;
    return user;
}

export function createInactiveUser() {
    const user = createGenericUser();
    user.status = UserStatus.INACTIVE;
    return user;
}

export async function saveUser(user: User) {
    const userDAO = await init();
    return await userDAO.createUsers([user]);
}
