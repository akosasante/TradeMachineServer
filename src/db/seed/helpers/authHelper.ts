import User from "../../../models/user";
import { signUpAuthentication } from "../../../authentication/auth";

export async function registerUser(user: User) {
    return new Promise((resolve, reject) => {
        signUpAuthentication(user.email, "testing123", undefined, (err, registeredUser) => {
            if (err) {
                reject(err);
            } else {
                resolve(registeredUser);
            }
        });
    });
}
