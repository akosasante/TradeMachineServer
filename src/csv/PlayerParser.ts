import { parseFile } from "@fast-csv/parse";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import PlayerDAO from "../DAO/PlayerDAO";
import Player, { PlayerLeagueType } from "../models/player";
import Team from "../models/team";
import { validateRow, WriteMode } from "./CsvUtils";
import { uniqWith } from "lodash";
import { rollbar } from "../bootstrap/rollbar";

/* eslint-disable @typescript-eslint/naming-convention */
interface PlayerCSVRow {
    Owner: string;
    Player: string;
    Position: string;
    Team: string;
    Level: "High" | "Low";
    [key: string]: string | undefined;
}
/* eslint-enable @typescript-eslint/naming-convention */

export async function processMinorLeagueCsv(
    csvFilePath: string,
    teams: Team[],
    dao: PlayerDAO,
    mode?: WriteMode
): Promise<Player[]> {
    await maybeDropMinorPlayers(dao, mode);

    logger.debug("WAITING ON STREAM");
    const parsedPlayers = await readAndParseMinorLeagueCsv(csvFilePath, teams);
    logger.debug("DONE PARSING");

    if (mode !== "return") {
        logger.debug("DEDUPING, ADDING PLAYER IDS, FILTERING OUT SAME NAME NULL PID ENTRIES");
        const playersToInsert = await formatForDb(parsedPlayers, dao, mode === "append");

        logger.debug(`INSERTING INTO DB ${playersToInsert.length} items`);
        return dao.batchUpsertPlayers(playersToInsert);
    } else {
        return parsedPlayers as Player[];
    }
}

async function maybeDropMinorPlayers(dao: PlayerDAO, mode?: WriteMode) {
    if (mode === "overwrite") {
        try {
            logger.debug("overwrite, so deleting all minor league players");
            await dao.deleteAllPlayers({ league: PlayerLeagueType.MINOR });
        } catch (e) {
            logger.error(inspect(e));
            rollbar.error(e);
            throw e;
        }
    }
}

async function readAndParseMinorLeagueCsv(path: string, teams: Team[]): Promise<Partial<Player>[]> {
    const parsedPlayers: Partial<Player>[] = [];
    return new Promise((resolve, reject) => {
        logger.debug("----------- starting to read csv ----------");
        parseFile(path, { headers: true })
            .on("data", (row: PlayerCSVRow) => {
                const parsedPlayer = parseMinorLeaguePlayer(row, teams);
                if (parsedPlayer) {
                    parsedPlayers.push(parsedPlayer);
                }
                // logger.debug(`parsed: ${parsedPlayers.length}`);
            })
            .on("error", (e: any) => reject(e))
            .on("end", (rowCount: number) => {
                logger.debug(`~~~~~~ reached end of stream. parsed ${rowCount} rows ~~~~~~~~~`);
                resolve(parsedPlayers);
            });
    });
}

function parseMinorLeaguePlayer(row: PlayerCSVRow, teams: Team[]): Partial<Player> | undefined {
    const MINOR_LEAGUE_PLAYER_PROPS = ["Owner", "Player", "Position", "Team", "Level"];

    const validRow = validateRow(row, MINOR_LEAGUE_PLAYER_PROPS);
    if (!validRow) {
        logger.error(`Invalid row while parsing player csv row: ${inspect(row)}`);
        rollbar.error(`Invalid row while parsing player csv row: ${inspect(row)}`);
        return undefined;
    }

    const ownedTeams = teams.filter(team => team.owners && team.owners.length);
    const leagueTeam = ownedTeams.find(team => team.owners!.some(owner => owner.csvName === row.Owner));

    if (!leagueTeam) {
        logger.error(`No matching owners found while parsing player csv row: ${inspect(row)}`);
        rollbar.error(`No matching owners found while parsing player csv row: ${inspect(row)}`);
        return undefined;
    }

    return {
        name: row.Player,
        league: PlayerLeagueType.MINOR,
        leagueTeam,
        meta: { minorLeaguePlayerFromSheet: { position: row.Position, leagueLevel: row.Level, mlbTeam: row.Team } },
    };
}

async function formatForDb(
    csvPlayers: Partial<Player>[],
    playerDAO: PlayerDAO,
    append = false
): Promise<Partial<Player>[]> {
    logger.debug(`CSV PLAYERS: ${csvPlayers.length}`);
    const existingPlayers = await playerDAO.getAllPlayers();
    logger.debug(`EXISTING PLAYERS: ${existingPlayers.length}`);

    // TODO: Figure out how to make this work better; instead of fetching all players, maybe just fetch ones with matching names
    // TODO: Figure out how to more accurately check for existing players. And log who we're including/excluding
    // Filter the csv list of players to get rid of null entries, and any entries that have the same name+playerDataId+mlbTeam
    // Then add the playerId of any existing players in the db that have the same name (this might be bad because it's possible a major leaguer who is different but has the same name exists...)
    const uniqueWithIds = uniqWith(
        csvPlayers.filter(player => !!player),
        (player1, player2) =>
            player1.name === player2.name &&
            player1.playerDataId === player2.playerDataId &&
            player1.mlbTeam === player2.mlbTeam
    ).map(player => {
        const existingPlayerSameName = existingPlayers.find(existing => existing.name === player.name);
        player.playerDataId = existingPlayerSameName?.playerDataId;
        return player;
    });

    // If we chose to overwrite, then take the unique list of players and if there's an existing player with the same name and player Id, reject it from the list
    return append
        ? uniqueWithIds
        : uniqueWithIds.filter(player => {
            const existingPlayerSameName = existingPlayers.find(existing => existing.name === player.name);
            return !(existingPlayerSameName && !existingPlayerSameName.playerDataId);
        });
}
