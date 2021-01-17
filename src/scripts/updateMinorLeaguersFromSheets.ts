import initializeDb from "../bootstrap/db";
import TeamDAO from "../DAO/TeamDAO";
import PlayerDAO from "../DAO/PlayerDAO";
import { getCsvFromUrl } from "../db/seed/helpers/csvHelper";
import { processMinorLeagueCsv } from "../csv/PlayerParser";
// tslint:disable:no-console

async function run() {
    const args = process.argv.slice(2);
    const MINOR_LEAGUE_SHEETS_URL = args[0] || "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRwHMjBxlsPTO9XPsiwuTroHi93Fijfx8bofQhnlrivopm2F898hqwzyyox5hyKePL3YacBFtbphK_/pub?gid=555552461&single=true&output=csv";
    const tempPath = "/tmp/trade_machine_2_csvs/";
    const MinorLeagueCsv = await getCsvFromUrl(MINOR_LEAGUE_SHEETS_URL, tempPath, `downloaded minor league players csv - ${Date.now()}.csv`);

    await initializeDb(true);
    const teamDAO = new TeamDAO();
    const playerDAO = new PlayerDAO();

    const allTeams = await teamDAO.getAllTeams();
    const mode: string = "append";
    // @ts-ignore
    return await processMinorLeagueCsv(MinorLeagueCsv, allTeams, playerDAO, mode);
}

run()
    .then(inserted => { console.log(`${inserted.length}`); process.exit(0); })
    .catch(err => { console.error(err); process.exit(99); });
