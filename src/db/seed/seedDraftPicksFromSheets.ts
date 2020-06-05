import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
import { getCsvFromUrl } from "./helpers/csvHelper";
import initializeDb from "../../bootstrap/db";
import { processDraftPickCsv } from "../../csv/DraftPickParser";
import TeamDAO from "../../DAO/TeamDAO";
import DraftPickDAO from "../../DAO/DraftPickDAO";
dotenvConfig({path: resolvePath(__dirname, "../../../.env")});

// tslint:disable:no-console

async function run() {
    const args = process.argv.slice(2);
    const DRAFT_PICK_SHEETS_URL = args[1] || "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRwHMjBxlsPTO9XPsiwuTroHi93Fijfx8bofQhnlrivopm2F898hqwzyyox5hyKePL3YacBFtbphK_/pub?gid=743305782&single=true&output=csv";
    const tempPath = "/tmp/trade_machine_2_csvs/";
    const DraftPickCsv = await getCsvFromUrl(DRAFT_PICK_SHEETS_URL, tempPath, `downloaded draft pick csv - ${Date.now()}.csv`);

    await initializeDb(process.env.DB_LOGS === "true");
    const allTeams = await (new TeamDAO()).getAllTeams();
    const mode: string = args[0] ?? "append";

    console.log("passing to csv processor");
    // @ts-ignore
    return await processDraftPickCsv(DraftPickCsv, allTeams, new DraftPickDAO(), mode);
}

run()
.then(inserted => { console.log(inserted.length); process.exit(0);
})
.catch(err => { console.error(err); process.exit(99); });
