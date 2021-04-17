/* eslint-disable */
import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
import initializeDb from "../../bootstrap/db";
import { processMinorLeagueCsv } from "../../csv/PlayerParser";
import PlayerDAO from "../../DAO/PlayerDAO";
import TeamDAO from "../../DAO/TeamDAO";
import { getCsvFromUrl } from "./helpers/csvHelper";
import logger from "../../bootstrap/logger";

dotenvConfig({path: resolvePath(__dirname, "../../../.env")});


async function run() {
    const args = process.argv.slice(2);
    const MINOR_LEAGUE_SHEETS_URL = args[1] || "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRwHMjBxlsPTO9XPsiwuTroHi93Fijfx8bofQhnlrivopm2F898hqwzyyox5hyKePL3YacBFtbphK_/pub?gid=555552461&single=true&output=csv";
    const tempPath = "/tmp/trade_machine_2_csvs/";
    const MinorLeagueCsv = await getCsvFromUrl(MINOR_LEAGUE_SHEETS_URL, tempPath, `downloaded minor league players csv - ${Date.now()}.csv`);

    await initializeDb(false);
    const teamDAO = new TeamDAO();
    const playerDAO = new PlayerDAO();

    const allTeams = await teamDAO.getAllTeams();
    let mode: string = "append";
    if (!!(args[0])) {
        mode = args[0];
    }

    logger.info("passing to csv processor");
    // @ts-ignore
    return await processMinorLeagueCsv(MinorLeagueCsv, allTeams, playerDAO, mode);
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
