import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
import initializeDb from "../../bootstrap/db";
import PlayerDAO from "../../DAO/PlayerDAO";
import EspnAPI from "../../espn/espnApi";
import logger from "../../bootstrap/logger";

dotenvConfig({path: resolvePath(__dirname, "../../../tests/.env")});


async function run() {
    const args = process.argv.slice(2);
    await initializeDb(process.env.DB_LOGS === "true");
    const espnApi = new EspnAPI(545);
    const playerDAO = new PlayerDAO();
    let year = 2020;
    if (args[0] && !isNaN(parseInt(args[0], 10))) {
        year = parseInt(args[0], 10);
    }

    return await espnApi.updateMajorLeaguePlayers(year, playerDAO);
}

run()
    .then(inserted => { logger.info(`${inserted.length}`); process.exit(0); })
    .catch(err => { logger.error(err); process.exit(99); });
