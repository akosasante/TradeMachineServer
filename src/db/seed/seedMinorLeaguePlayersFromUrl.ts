import axios, { AxiosResponse } from "axios";
import initializeDb from "../../bootstrap/db";
import PlayerDAO from "../../DAO/PlayerDAO";
import Player, { PlayerLeagueType } from "../../models/player";
import { uniqWith, partition, merge } from "lodash";
import logger from "../../bootstrap/logger";

// tslint:disable:no-console

async function run() {
    await initializeDb(false);
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

    logger.debug(`Got ${allPlayersAllLeagues.length} players from url.`);
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
            name: player.split(",").reverse().join(" ").trim(),
            league: PlayerLeagueType.MINOR,
            playerDataId: rest.player_id,
            meta: { minorLeaguePlayer: rest },
        });
    });
}

async function insertParsedPlayers(dao: PlayerDAO, parsedPlayers: Player[]) {
    const [playersToUpdate, playersToInsert] = await formatForDb(parsedPlayers, dao);
    logger.debug(`Updating ${playersToUpdate.length}. Inserting ${playersToInsert.length}`);
    const insertedPlayers = await dao.batchUpsertPlayers(playersToInsert);
    const updatedPlayers = await Promise.all(playersToUpdate.map(p => dao.updatePlayer(p.id!, p)));
    return insertedPlayers.concat(updatedPlayers);
}

async function formatForDb(csvPlayers: Partial<Player>[], playerDAO: PlayerDAO): Promise<[Partial<Player>[], Partial<Player>[]]> {
    const existingPlayers = await playerDAO.getAllPlayers();

    const dedupedPlayers = uniqWith(csvPlayers.filter(player => !!player), (player1, player2) =>
        (player1.name === player2.name) &&
        (player1.playerDataId === player2.playerDataId)
    );

    // tslint:disable-next-line:prefer-const
    let [playersToUpdate, playersToInsert] = partition<Partial<Player>>(dedupedPlayers, player => {
        const existingPlayerSameName = existingPlayers.find(existing => existing.name === player.name);
        return existingPlayerSameName && !existingPlayerSameName.playerDataId;
    });

    playersToUpdate = playersToUpdate.map(player => ({
        ...player,
        id: (existingPlayers.find(existing => existing.name === player.name))?.id,
        meta: merge((existingPlayers.find(existing => existing.name === player.name))?.meta, player.meta),
    }));
    return [playersToUpdate, playersToInsert];
}

run()
    .then(inserted => { console.log(inserted.length); process.exit(0); })
    .catch(err => { console.error(err); process.exit(99); });
