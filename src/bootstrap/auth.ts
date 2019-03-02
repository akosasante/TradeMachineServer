import { get } from "lodash";
import { Action, UnauthorizedError } from "routing-controllers";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import util from "util";
import { ConflictError } from "../api/middlewares/ErrorHandler";
import UserDAO from "../DAO/user";
import User, { Role } from "../models/user";
import logger from "./logger";

export async function serializeUser(user: User): Promise<number|undefined> {
    logger.debug("serializing user");
    return user ? user.id : undefined;
}

export async function deserializeUser(id: number): Promise<User|undefined> {
    if (id) {
        logger.debug("deserializing user");
        const userDAO = new UserDAO();
        return await userDAO.getUserById(id);
    }
}

export async function signUpAuthentication(email: string, password: string,
                                           done: (err?: Error, user?: User) => any): Promise<void> {
    try {
        logger.debug("sign up strategy");
        const userDAO = new UserDAO();
        const user = await userDAO.findUser({email}, false);
        if (!user) {
            logger.debug("no existing user with that email");
            const hashedPass = await User.generateHashedPassword(password);
            logger.debug(hashedPass);
            const newUser = await userDAO.createUser({email, password: hashedPass, lastLoggedIn: new Date()}, true);
            logger.debug(newUser);
            return done(undefined, newUser);
        } else if (user && !user.password) {
            logger.debug("user found with unset password");
            const hashedPass = await User.generateHashedPassword(password);
            const updatedUser = await userDAO.updateUser(user.id!, {password: hashedPass, lastLoggedIn: new Date()});
            return done(undefined, updatedUser);
        } else {
            return done(new ConflictError("Email already in use and signed up."));
        }
    } catch (error) {
        logger.error("Error in sign-up strategy");
        logger.error(error);
        return done(error);
    }
}

export async function signInAuthentication(email: string, password: string,
                                           done: (err?: Error, user?: User) => any): Promise<void> {
    try {
        logger.debug("sign in strategy");
        const userDAO = new UserDAO();
        // Will throw EntityNotFoundError if user is not found
        let user = await userDAO.findUser({email});
        const validPassword = await user!.isPasswordMatching(password);
        if (user && validPassword) {
            logger.debug("updating user last logged in");
            user = await userDAO.updateUser(user.id!, { lastLoggedIn: new Date() });
            return done(undefined, user);
        } else {
            return done(new Error("Incorrect password"));
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
        const userHasRole = roles.some(role => user.hasRole(role));
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

async function getUserFromAction(action: Action): Promise<User|undefined> {
    const userId = get(action, "request.session.user");
    logger.debug(`Current userId: ${userId}`);
    return userId ? await deserializeUser(userId) : undefined;
}
