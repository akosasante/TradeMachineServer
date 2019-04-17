import UserDAO from "../../../DAO/UserDAO";
import User from "../../../models/user";

async function init() {
    return new UserDAO();
}

export async function registerUser(user: User) {
    const userDAO = await init();
    const hashedPass = await User.generateHashedPassword("testing123");
    const updatedUser = await userDAO.updateUser(user.id!, {password: hashedPass, lastLoggedIn: new Date()});
    return updatedUser;
}
