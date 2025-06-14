import { compare, hash } from "bcryptjs";
import { isAfter } from "date-fns";
import { Action, BadRequestError, NotFoundError } from "routing-controllers";
import { inspect } from "util";
import { ConflictError } from "../api/middlewares/ErrorHandler";
import logger from "../bootstrap/logger";
import UserDAO from "../DAO/UserDAO";
import v2UserDAO, { PublicUser } from "../DAO/v2/UserDAO";
import User, { Role } from "../models/user";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import { rollbar } from "../bootstrap/rollbar";

export function serializeUser(user: User | PublicUser): string | undefined {
    logger.debug("serializing user");
    return user?.id;
}

export async function deserializeUser(id: string, userDAO: UserDAO = new UserDAO()): Promise<User> {
    logger.debug("deserializing user");
    return await userDAO.getUserById(id);
}

export async function signUpAuthentication(
    email: string,
    password: string,
    userDAO: UserDAO | v2UserDAO = new UserDAO(),
    done: (err?: Error, user?: User | PublicUser) => void
): Promise<void> {
    try {
        logger.debug("sign up strategy");
        const user = await userDAO.findUserWithPasswordByEmail(email);
        if (!user) {
            logger.debug("no existing user with that email");
            const hashedPass = await generateHashedPassword(password);
            const [newUser] = await userDAO.createUsers([{ email, password: hashedPass, lastLoggedIn: new Date() }]);
            return done(undefined, newUser);
        } else if (user && !user.password) {
            logger.debug("user found with unset password");
            const hashedPass = await generateHashedPassword(password);
            const updatedUser = await userDAO.updateUser(user.id!, { password: hashedPass, lastLoggedIn: new Date() });
            return done(undefined, updatedUser);
        } else {
            return done(new ConflictError("Email already in use and signed up."));
        }
    } catch (error) {
        logger.error("Error in sign-up strategy");
        logger.error(error);
        rollbar.error(inspect(error));
        return done(error as Error);
    }
}

export async function signInAuthentication(
    email: string,
    password: string,
    userDAO: UserDAO = new UserDAO(),
    done: (err?: Error, user?: User) => void
): Promise<void> {
    try {
        logger.debug("sign in strategy");
        // Will throw EntityNotFoundError if user is not found
        const user = await userDAO.findUserWithPasswordByEmail(email);
        if (user) {
            logger.debug("found user with matching email");
            const validPassword = user.password && (await isPasswordMatching(password, user.password));
            if (validPassword) {
                logger.debug("password matched - updating user last logged in");
                const returnedUser = await userDAO.updateUser(user.id!, { lastLoggedIn: new Date() });
                return done(undefined, returnedUser);
            } else {
                return done(new BadRequestError("Incorrect password"));
            }
        } else {
            logger.error(`Could not find user with this email when trying to sign in. input_email=${email}`);
            rollbar.error(`Could not find user with this email when trying to sign in. input_email=${email}`);
            return done(new NotFoundError("Error with sign-in strategy: no user found"));
        }
    } catch (error) {
        logger.error(
            `${
                error instanceof EntityNotFoundError
                    ? "Could not find user with this email when trying to sign in"
                    : "Error with sign-in strategy"
            }`
        );
        logger.error(error);
        rollbar.error(inspect(error));
        return done(error as Error);
    }
}

export async function authorizationChecker(
    action: Action,
    allowedRoles: Role[],
    userDAO: UserDAO = new UserDAO()
): Promise<boolean> {
    logger.debug("checking user roles");
    const user = await getUserFromAction(action, userDAO);
    if (user) {
        const userHasRole = allowedRoles.some(role => user.role === role);
        logger.debug(`user_role=${user.role} allowedRoles=${inspect(allowedRoles)}`);
        return !allowedRoles.length || userHasRole || user.isAdmin();
    } else {
        logger.error("could not find user in action");
        return false;
    }
}

export async function currentUserChecker(action: Action, userDAO: UserDAO = new UserDAO()): Promise<User | undefined> {
    logger.debug("checking current user");
    return await getUserFromAction(action, userDAO);
}

export function passwordResetDateIsValid(passwordExpiry?: Date): boolean {
    logger.debug(`Comparing password expiry date=${passwordExpiry}`);
    return Boolean(passwordExpiry && isAfter(passwordExpiry, new Date()));
}

export async function generateHashedPassword(plainPassword: string): Promise<string> {
    logger.debug("hashing password");
    const saltFactor = process.env.NODE_ENV !== "production" ? 1 : 15;
    return hash(plainPassword, saltFactor);
}

async function getUserFromAction(action: Action, userDAO: UserDAO = new UserDAO()): Promise<User | undefined> {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    const userId = action.request?.session?.user as string;
    logger.debug(inspect(action.request.session));
    logger.debug(inspect(action.request.sessionID));
    logger.debug(`Current userId: ${userId}`);
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    return userId ? await deserializeUser(userId, userDAO) : undefined;
}

async function isPasswordMatching(password: string, userPassword: string): Promise<boolean> {
    logger.debug(`comparing ${password} to user=${userPassword}`);
    return compare(password, userPassword || "");
}
