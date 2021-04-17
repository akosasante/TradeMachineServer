/* eslint-disable */
import initializeDb from "../../bootstrap/db";
import { createGenericTeam, createInactiveTeam, saveOwners, saveTeam } from "./helpers/teamCreator";
import Team from "../../models/team";
import UserDAO from "../../DAO/UserDAO";
import logger from "../../bootstrap/logger";
import { inspect } from "util";

async function run() {
    const args = process.argv.slice(2);
    await initializeDb(process.env.DB_LOGS === "true");
    let team = getTeamObj(args);
    if (!team) {
        return;
    }
    [team] = await saveTeam(team);
    switch ((args[0] || "").toLowerCase()) {
        case "owned":
            logger.info("Setting custom ownership");
            if (args[1]) {
                logger.info(`Owner: ${args[1]}`);
                const userDao = new UserDAO();
                const user = await userDao.getUserById(args[1]);
                if (user) {
                    return await saveOwners(team, [user]);
                } else {
                    logger.info("No user with that ID available in DB. Skipping setting owner");
                    return undefined;
                }
            } else {
                logger.info("No owner ID passed in. Skipping seed.");
                return undefined;
            }
        case "custom":
            if (args[1] && JSON.parse(args[1]).owners) {
                logger.info("Custom team included owners");
                return await saveOwners(team, JSON.parse(args[1]).owners);
            } else {
                logger.info("Custom team did not include owners. Setting random ownership");
                return await saveOwners(team);
            }
        default:
            logger.info("Setting random ownership");
            return await saveOwners(team);
    }
}

function getTeamObj(args: any[]) {
    switch ((args[0] || "").toLowerCase()) {
        case "custom":
            logger.info("Creating a custom team");
            if (args[1]) {
                const teamObj = JSON.parse(args[1]);
                logger.info(`Passing in the object: ${teamObj}`);
                return new Team(teamObj);
            } else {
                logger.info("No custom object passed in. Skipping seed.");
                return undefined;
            }

        case "inactive":
            logger.info("Creating an inactive team");
            return createInactiveTeam();
        default:
            logger.info("Creating generic team");
            return createGenericTeam();
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
/* eslint-enable */
