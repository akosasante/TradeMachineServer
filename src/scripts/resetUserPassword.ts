import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
dotenvConfig({ path: resolvePath(__dirname, "../../.env") });
import initializeDb from "../bootstrap/db";
import { generateHashedPassword } from "../authentication/auth";
import logger from "../bootstrap/logger";
import { inspect } from "util";
import UserDAO from "../DAO/UserDAO";

async function run() {
    const args = process.argv.slice(2);
    const email = args[0];
    const newPassword = args[1];

    if (!email || !newPassword) {
        logger.error("Usage: ts-node src/scripts/resetUserPassword.ts <email> <newPassword>");
        return;
    }

    await initializeDb(process.env.DB_LOGS === "true");

    try {
        const userDAO = new UserDAO();
        const user = await userDAO.findUser({ email }, false);

        if (!user) {
            logger.error(`No user found with email: ${email}`);
            return;
        }

        const hashedPassword = await generateHashedPassword(newPassword);
        const updatedUser = await userDAO.updateUser(user.id!, {
            password: hashedPassword,
            passwordResetExpiresOn: undefined,
            passwordResetToken: undefined,
        });

        logger.info(`Password updated for user: ${email}`);
        logger.info(inspect(updatedUser));
    } catch (error) {
        logger.error("Error updating password:");
        logger.error(inspect(error));
    }
}

/**
 * Call with: ts-node src/scripts/resetUserPassword.ts <email> <newPassword>
 */
run()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        logger.error(err);
        process.exit(1);
    });
