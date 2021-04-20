/* eslint-disable */
import initializeDb from "../../bootstrap/db";
import PlayerDAO from "../../DAO/PlayerDAO";
import { doUpdate } from "../../scheduled_jobs/mlbMinorsScheduledUpdate";
import logger from "../../bootstrap/logger";

async function run() {
    await initializeDb(false);
    const playerDAO = new PlayerDAO();
    return await doUpdate(playerDAO);
}

run()
    .then(inserted => {
        logger.info(`${inserted.length}`);
        process.exit(0);
    })
    .catch(err => {
        logger.error(err);
        process.exit(99);
    });
/* eslint-enable */
