import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
import initializeDb from "../../bootstrap/db";
import { registerUser } from "./helpers/authHelper";
import { createAdminUser, createGenericUser, createInactiveUser, saveUser } from "./helpers/userCreator";
import User from "../../models/user";
import logger from "../../bootstrap/logger";
import { inspect } from "util";

dotenvConfig({path: resolvePath(__dirname, "../../../.env")});


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

run()
    .then(user => {
        logger.info(inspect(user));
        process.exit(0);
    })
    .catch(err => {
        logger.error(err);
        process.exit(999);
    });
