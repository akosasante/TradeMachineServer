import { User } from "@akosasante/trade-machine-models";
import { compare, hash } from "bcryptjs";
import { get } from "lodash";
import { Action, BadRequestError } from "routing-controllers";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import { inspect } from "util";
import { ConflictError } from "../api/middlewares/ErrorHandler";
import logger from "../bootstrap/logger";
import UserDAO from "../DAO/UserDAO";
import UserDO, { Role } from "../models/user";

export async function generateHashedPassword(plainPassword: string): Promise<string> {
    logger.debug("hashing password");
    const saltFactor = process.env.NODE_ENV !== "production" ? 1 : 15;
    return hash(plainPassword, saltFactor)
        .then(pass => pass)
        .catch(err => err);
}

export async function serializeUser(user: User): Promise<string | undefined> {
    logger.debug("serializing user");
    return user ? user.id : undefined;
}

export async function deserializeUser(id: string): Promise<User> {
    logger.debug("deserializing user");
    const userDAO = new UserDAO();
    return await userDAO.getUserById(id);
}

// export async function signUpAuthentication(email: string, password: string,
//                                            done: (err?: Error, user?: User) => any): Promise<void> {
//     try {
//         logger.debug("sign up strategy");
//         const userDAO = new UserDAO();
//         const user = await userDAO.findUser({email}, false);
//         if (!user) {
//             logger.debug("no existing user with that email");
//             const hashedPass = await User.generateHashedPassword(password);
//             logger.debug(hashedPass);
//             const newUser = await userDAO.createUser({email, password: hashedPass, lastLoggedIn: new Date()}, true);
//             logger.debug(newUser);
//             return done(undefined, newUser);
//         } else if (user && !user.password) {
//             logger.debug("user found with unset password");
//             const hashedPass = await User.generateHashedPassword(password);
//             const updatedUser = await userDAO.updateUser(user.id!, {password: hashedPass, lastLoggedIn: new Date()});
//             return done(undefined, updatedUser);
//         } else {
//             return done(new ConflictError("Email already in use and signed up."));
//         }
//     } catch (error) {
//         logger.error("Error in sign-up strategy");
//         logger.error(error);
//         return done(error);
//     }
// }
//
export async function signInAuthentication(email: string, password: string,
                                           done: (err?: Error, user?: User) => any): Promise<void> {
    try {
        logger.debug("sign in strategy");
        logger.debug(email);
        logger.debug(password);
        const userDAO = new UserDAO();
        // Will throw EntityNotFoundError if user is not found
        logger.debug(inspect(await userDAO.getAllUsers()));
        const user = await userDAO.findUser({email});
        logger.debug(inspect(user));
        if (user) {
            const userPassword = await userDAO.getUserPassword(user.id!);
            const validPassword = userPassword ? await isPasswordMatching(password, userPassword) : false;
            if (validPassword) {
                logger.debug("updating user last logged in");
                await userDAO.updateUser(user.id!, {lastLoggedIn: new Date()});
                return done(undefined, user);
            } else {
                return done(new BadRequestError("Incorrect password"));
            }
        }
    } catch (error) {
        logger.error(`${error instanceof EntityNotFoundError ?
            "Could not find user with this email when trying to sign in" :
            "Error with sign-in strategy"}`);
        logger.error(error);
        return done(error);
    }
}

export async function authorizationChecker(action: Action, roles: Role[]): Promise<boolean> {
    logger.debug("checking roles");
    const user = await getUserFromAction(action);
    if (user) {
        const userHasRole = roles.some(role => user.role === role);
        return (!roles.length || userHasRole || user.isAdmin());
    } else {
        return false;
    }
}

export async function currentUserChecker(action: Action) {
    logger.debug("checking current user");
    try {
        return !!(await getUserFromAction(action));
    } catch (error) {
        // Assuming error was due to not being able to find user with this ID
        return false;
    }
}

async function getUserFromAction(action: Action): Promise<User | undefined> {
    const userId = get(action, "request.session.user");
    logger.debug(inspect(action.request.session));
    logger.debug(inspect(action.request.sessionID));
    logger.debug(`Current userId: ${userId}`);
    return userId ? await deserializeUser(userId) : undefined;
}

async function isPasswordMatching(userPasssword: string, password: string): Promise<boolean> {
    logger.debug(`comparing ${password} to user=${userPasssword}`);
    return compare(password, userPasssword || "");
}
