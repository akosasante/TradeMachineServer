import axios from "axios";
import initializeDb from "../../bootstrap/db";
import PlayerDAO from "../../DAO/PlayerDAO";
import Player, { LeagueLevel } from "../../models/player";

// tslint:disable:no-console

async function run() {
    await initializeDb(process.env.DB_LOGS === "true");
    const playerDAO = new PlayerDAO();
    const axiosInst = axios.create({
        timeout: 20000,
    });

    const emptyQuery = "";
    // tslint:disable-next-line:max-line-length
    const endpoint = `http://lookup-service-prod.mlb.com/json/named.search_player_all.bam?sport_code='mlb'&active_sw='Y'&name_part='%25${emptyQuery}%25'`;

    const allPlayers = await axiosInst.get(endpoint)
        .then(parsePlayerJson)
        .catch(err => {
            throw err;
        });

    const parsedPlayers = parsePlayers(allPlayers);
    return await insertParsedPlayers(playerDAO, parsedPlayers);
}

function parsePlayerJson(playerJson: object): any[] {
    // @ts-ignore
    return playerJson.data.search_player_all.queryResults.row;
}

function parsePlayers(allPlayers: any[]): Player[] {
    return allPlayers.map(player => {
        const {name_display_first_last, team_full, ...rest} = player;
        return new Player({
            name: name_display_first_last,
            league: LeagueLevel.MAJOR,
            mlbTeam: team_full,
            meta: rest,
        });
    });
}

async function insertParsedPlayers(dao: PlayerDAO, parsedPlayers: Player[]) {
    return dao.batchCreatePlayers(parsedPlayers);
}

run()
    .then(inserted => { console.log(inserted.length); process.exit(0); })
    .catch(err => { console.error(err); process.exit(99); });
