import axios, { AxiosResponse } from "axios";
import initializeDb from "../../bootstrap/db";
import PlayerDAO from "../../DAO/PlayerDAO";
import Player, { PlayerLeagueType } from "../../models/player";

// tslint:disable:no-console

async function run() {
    await initializeDb(process.env.DB_LOGS === "true");
    const playerDAO = new PlayerDAO();
    const axiosInst = axios.create({
        timeout: 20000,
    });

    const endpoint = "http://mlb.mlb.com/lookup/json/named.ops_team_players.bam";
    const leagueLevelIds = [11, 12, 13];

    const allPlayersAllLeagues = await Promise.all(leagueLevelIds.map(id => axiosInst.get(`${endpoint}?sport_id=${id}`)))
        .then(parseResponse)
        .then(parsePlayerJson)
        .catch(err => {
            throw err;
        });

    return await insertParsedPlayers(playerDAO, allPlayersAllLeagues);
}

function parseResponse(responses: AxiosResponse[]): any[] {
    // any here is a "player object" form mlb
    return responses.flatMap(response => response.data.ops_team_players.queryResults.row);
}

function parsePlayerJson(allPlayers: any[]): Player[] {
    return allPlayers.map(playerObj => {
        const {player, ...rest} = playerObj;
        return new Player({
            name: player.split(",").reverse().join(" "),
            league: PlayerLeagueType.MINOR,
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
