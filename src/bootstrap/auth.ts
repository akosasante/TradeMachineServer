import { get } from "lodash";
import { Action } from "routing-controllers";
import util from "util";
import UserDAO from "../DAO/user";
import User, { Role } from "../models/user";
import logger from "./logger";

export async function serializeUser(user: User): Promise<number|undefined> {
    logger.debug("serializing user");
    return user.id;
}

export async function deserializeUser(id: number): Promise<User> {
        logger.debug("deserializing user");
        const userDAO = new UserDAO();
        return await userDAO.getUserById(id);
}

export async function signUpAuthentication(email: string, password: string,
                                           done: (err?: Error, user?: User) => any): Promise<void> {
    try {
        logger.debug("sign up strategy");
        const userDAO = new UserDAO();
        const user = await userDAO.findUser({email});
        if (!user) {
            const hashedPass = await User.generateHashedPassword(password);
            const newUser = await userDAO.createUser({email, password: hashedPass});
            return done(undefined, newUser);
        } else {
            return done(new Error("Email already in use."));
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
        const user = await userDAO.findUser({email});
        const validPassword = await user.isPasswordMatching(password);
        if (user && validPassword) {
            return done(undefined, user);
        } else if (!validPassword) {
            return done(new Error("Incorrect password"));
        } else if (!user) {
            return done(new Error("No user with that email"));
        }
    } catch (error) {
        logger.error("Error with sign-in strategy");
        logger.error(error);
        return done(error);
    }
}

export async function authorizationChecker(action: Action, roles: Role[]): Promise<boolean> {
    logger.debug("checking roles");
    const user = await getUserFromAction(action);
    const userHasRole = roles.some(role => user.hasRole(role));
    return (user && (!roles.length || userHasRole || user.isAdmin()));
}

export async function currentUserChecker(action: Action) {
    logger.debug("checking current user");
    return  getUserFromAction(action);
}

async function getUserFromAction(action: Action): Promise<User> {
    const userId = get(action, "request.session.user");
    return await deserializeUser(userId);
}
