import axios from "axios";
import * as fs from "fs";
import initializeDb from "../../bootstrap/db";
import { processMinorLeagueCsv } from "../../csv/PlayerParser";
import PlayerDAO from "../../DAO/PlayerDAO";
import TeamDAO from "../../DAO/TeamDAO";

// tslint:disable:no-console

async function run() {
    const MINOR_LEAGUE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRwHMjBxlsPTO9XPsiwuTroHi93Fijfx8bofQhnlrivopm2F898hqwzyyox5hyKePL3YacBFtbphK_/pub?gid=555552461&single=true&output=csv";
    const MinorLeagueCsv = await getCsvFromUrl(MINOR_LEAGUE_SHEETS_URL);

    await initializeDb(process.env.DB_LOGS === "true");
    const teamDAO = new TeamDAO();
    const playerDAO = new PlayerDAO();

    const allTeams = await teamDAO.getAllTeams();

    return await processMinorLeagueCsv(MinorLeagueCsv, allTeams, playerDAO, "append");
}

async function getCsvFromUrl(url: string) {
    const { data } = await axios.get(url);
    const playersCsvPath = `/tmp/trade_machine_2_csvs/downloaded minor league players csv - ${Date.now()}.csv`;
    fs.writeFileSync(playersCsvPath, data);
    return playersCsvPath;
}

run()
    .then(inserted => { console.log(inserted.length); process.exit(0); })
    .catch(err => { console.error(err); process.exit(99); });
