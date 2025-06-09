import User from "../../../models/user";
import { signUpAuthentication } from "../../../authentication/auth";
import UserDAO from "../../../DAO/UserDAO";
import v2UserDAO from "../../../DAO/v2/UserDAO";

export async function registerUser(user: User, dao: UserDAO | v2UserDAO | undefined = undefined) {
    return new Promise((resolve, reject) => {
        signUpAuthentication(user.email, "testing123", dao, (err, registeredUser) => {
            if (err) {
                reject(err);
            } else {
                resolve(registeredUser);
            }
        });
    });
}
