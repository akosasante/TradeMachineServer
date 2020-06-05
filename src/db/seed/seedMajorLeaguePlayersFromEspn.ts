import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
dotenvConfig({path: resolvePath(__dirname, "../../../tests/.env")});
import initializeDb from "../../bootstrap/db";
import PlayerDAO from "../../DAO/PlayerDAO";
import Player from "../../models/player";
import EspnAPI from "../../espn/espnApi";
import { uniqWith } from "lodash";

// tslint:disable:no-console

async function run() {
    const args = process.argv.slice(2);
    await initializeDb(process.env.DB_LOGS === "true");
    const espnApi = new EspnAPI(545);
    const playerDAO = new PlayerDAO();
    let year = 2020;
    if (args[0] && !isNaN(parseInt(args[0], 10))) {
        year = parseInt(args[0], 10);
    }

    console.log(`making espn api call for year: ${year}`);
    const allEspnPlayers = await espnApi.getAllMajorLeaguePlayers(year);
    console.log("mapping to player objects");
    const allPlayers = allEspnPlayers.map(player => Player.convertEspnMajorLeaguerToPlayer(player));
    console.log("deduping all players");
    const dedupedPlayers = uniqWith(allPlayers, (player1, player2) => (player1.name === player2.name) && (player1.playerDataId === player2.playerDataId));
    console.log("batch save to db");
    return await playerDAO.batchUpsertPlayers(dedupedPlayers);
}

run()
    .then(inserted => { console.log(inserted.length); process.exit(0); })
    .catch(err => { console.error(err); process.exit(99); });
