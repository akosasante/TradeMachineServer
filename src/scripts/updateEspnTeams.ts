/* eslint-disable */
import initializeDb from "../bootstrap/db";
import EspnAPI from "../espn/espnApi";
import TeamDAO from "../DAO/TeamDAO";

async function run() {
    const args = process.argv.slice(2);
    await initializeDb(true);

    const teamDao = new TeamDAO();
    const espnApi = new EspnAPI(545);
    const year = Number(args[0]) || 2023;

    await espnApi.updateEspnTeamInfo(year, teamDao);
}

run()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(99);
    });
/* eslint-enable */
