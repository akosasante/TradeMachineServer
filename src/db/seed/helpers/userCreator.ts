import { internet, name as fakeName } from "faker";
import UserDAO from "../../../DAO/UserDAO";
import User, { Role, UserStatus } from "../../../models/user";

async function init() {
    return new UserDAO();
}

export function createGenericUser() {
    const username = internet.userName();
    const email = internet.email();
    const name = fakeName.findName();
    return new User({username, email, name});
}

export async function createAdminUser() {
    const user = createGenericUser();
    user.roles = [Role.ADMIN];
    return user;
}

export async function createInactiveUser() {
    const user = createGenericUser();
    user.status = UserStatus.INACTIVE;
    return user;
}

export async function saveUser(user: User) {
    const dao = await init();
    return await dao.createUser(user);
}
