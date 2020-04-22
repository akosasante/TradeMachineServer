import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
dotenvConfig({path: resolvePath(__dirname, "../../../.env")});
import axios from "axios";
import initializeDb from "../../bootstrap/db";
import { processMinorLeagueCsv } from "../../csv/PlayerParser";
import PlayerDAO from "../../DAO/PlayerDAO";
import TeamDAO from "../../DAO/TeamDAO";
import { writeFileSync } from "fs";

// tslint:disable:no-console

async function run() {
    const args = process.argv.slice(2);
    const MINOR_LEAGUE_SHEETS_URL = args[1] || "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRwHMjBxlsPTO9XPsiwuTroHi93Fijfx8bofQhnlrivopm2F898hqwzyyox5hyKePL3YacBFtbphK_/pub?gid=555552461&single=true&output=csv";
    const MinorLeagueCsv = await getCsvFromUrl(MINOR_LEAGUE_SHEETS_URL);

    await initializeDb(process.env.DB_LOGS === "true");
    const teamDAO = new TeamDAO();
    const playerDAO = new PlayerDAO();

    const allTeams = await teamDAO.getAllTeams();
    let mode: string = "append";
    if (!!(args[0])) {
        mode = args[0];
    }

    console.log("passing to csv processor");
    // @ts-ignore
    return await processMinorLeagueCsv(MinorLeagueCsv, allTeams, playerDAO, mode);
}

async function getCsvFromUrl(url: string) {
    console.log(`Getting minor sheet url: ${url}`);
    const { data } = await axios.get(url);
    const playersCsvPath = `/tmp/trade_machine_2_csvs/downloaded minor league players csv - ${Date.now()}.csv`;
    console.log("Saving to temp file");
    writeFileSync(playersCsvPath, data);
    console.log("Save successful");
    return playersCsvPath;
}

run()
    .then(inserted => { console.log(inserted.length); process.exit(0); })
    .catch(err => { console.error(err); process.exit(99); });
