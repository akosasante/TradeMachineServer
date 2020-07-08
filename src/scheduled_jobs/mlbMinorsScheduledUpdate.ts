import logger from "../bootstrap/logger";
import Bull from "bull";
import PlayerDAO from "../DAO/PlayerDAO";
import axios, { AxiosResponse } from "axios";
import Player, { PlayerLeagueType } from "../models/player";
import { merge, partition, uniqWith } from "lodash";
import { inspect } from "util";
import { v4 as uuid } from "uuid";
import { cleanJobForLogging } from "./job_utils";
import Rollbar from "rollbar";

const rollbar = new Rollbar({
    accessToken: process.env.ROLLBAR_TOKEN,
    environment: process.env.NODE_ENV,
    verbose: true,
});

export function setupScheduledMlbMinorLeagueUpdates() {
    const cron = "22 7 * * *"; // daily at 3:22AM ET
    logger.info(`Setting up minor league updates from mlb api to run on schedule ${cron}`);
    const mlbQueue = new Bull("mlb_api_queue", {settings: {maxStalledCount: 0}});
    const JobName = "minor_league_updates";
    const cleanLoggedData = (_data: any) => "";
    const cleanLoggedReturn = (returnValue: any) => returnValue;

    mlbQueue.process(JobName, async () => {
        return await updateMinorLeaguePlayers({});
    });
    mlbQueue.add(JobName, uuid(), { repeat: { cron } });

    mlbQueue.on("error", error => {
        logger.error(`Bull error during mlbMinorsScheduledUpdate: ${inspect(error)}`);
        rollbar.error(error);
    });

    mlbQueue.on("active", job => {
        logger.info(`mlbMinorsScheduledUpdate Worker job started: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    mlbQueue.on("completed", (job, _result) => {
         logger.info(`mlbMinorsScheduledUpdate Worker completed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}`);
    });

    mlbQueue.on("failed", (job, err) => {
        logger.error(`"mlbMinorsScheduledUpdate Worker failed: ${inspect(cleanJobForLogging(job, cleanLoggedReturn, cleanLoggedData))}, ${inspect(err)}`);
        rollbar.error(err);
    });
}

export interface MinorLeagueUpdateDeps {
    playerDao?: PlayerDAO;
}

async function updateMinorLeaguePlayers(deps: MinorLeagueUpdateDeps) {
    const playerDao = deps.playerDao || new PlayerDAO();
    await doUpdate(playerDao);
    return `updated @ ${new Date().toLocaleDateString()}`;
}

export async function doUpdate(playerDAO: PlayerDAO) {
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
