import initializeDb from "../bootstrap/db";
import EspnAPI from "../espn/espnApi";
import TeamDAO from "../DAO/TeamDAO";
import PlayerDAO from "../DAO/PlayerDAO";

async function run() {
    const args = process.argv.slice(2);
    await initializeDb(true);

    const playerDao = new PlayerDAO();
    const teamDao = new TeamDAO();
    const espnApi = new EspnAPI(545);
    const year = Number(args[0]) || 2020;

    await espnApi.updateMajorLeaguePlayers(year, playerDao, teamDao);
}

// tslint:disable-next-line:no-console
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(99); });
