/* eslint-disable */
import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
dotenvConfig({ path: resolvePath(__dirname, "../../../.env") });
import initializeDb from "../../bootstrap/db";
import { registerUser } from "./helpers/authHelper";
import { createAdminUser, createGenericUser, createInactiveUser, saveUser } from "./helpers/userCreator";
import User from "../../models/user";
import logger from "../../bootstrap/logger";
import { inspect } from "util";

async function run() {
    const args = process.argv.slice(2);
    await initializeDb(process.env.DB_LOGS === "true");
    let user = getUserObj(args);
    if (user) {
        [user] = await saveUser(user);
        return await registerUser(user);
    }
}

function getUserObj(args: any[]) {
    switch ((args[0] || "").toLowerCase()) {
        case "custom":
            logger.info("Creating a custom user");
            if (args[1]) {
                logger.info(args[1]);
                const userObj = JSON.parse(args[1]);
                logger.info(`Passing in the object: ${userObj}`);
                return new User(userObj);
            } else {
                logger.info("No custom object passed in. Skipping seed.");
                return undefined;
            }
        case "inactive":
            logger.info("Creating an inactive user");
            return createInactiveUser();
        case "admin":
            logger.info("Creating an admin user");
            return createAdminUser();
        default:
            logger.info("Creating a generic user");
            return createGenericUser();
    }
}

/**
 * Call with: DB_LOGS=<optional_boolean> ts-node src/db/seed/seedUser.ts <admin|inactive|null> (to create an admin-role user, inactive-status user, or owner-role user)
 * Call with: DB_LOGS=<optional_boolean> ts-node src/db/seed/seedUser.ts custom <user_obj_json> to create a user with the specific shape passed in
 */
run()
    .then(user => {
        logger.info(inspect(user));
        process.exit(0);
    })
    .catch(err => {
        logger.error(err);
        process.exit(999);
    });
/* eslint-enable */
