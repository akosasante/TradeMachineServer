import csv from "fast-csv";
import { createReadStream } from "fs";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import PlayerDAO from "../DAO/PlayerDAO";
import Player, { PlayerLeagueType } from "../models/player";
import Team from "../models/team";
import { validateRow, WriteMode } from "./CsvUtils";
import { uniqWith } from "lodash";


interface PlayerCSVRow {
    Owner: string;
    Player: string;
    Position: string;
    Team: string;
    Level: "High"|"Low";
}

export async function processMinorLeagueCsv(csvFilePath: string, teams: Team[], dao: PlayerDAO, mode?: WriteMode)
    : Promise<Player[]> {

    await maybeDropMinorPlayers(dao, mode);

    logger.debug("WAITING ON STREAM");
    const parsedPlayers = await readAndParseMinorLeagueCsv(csvFilePath, teams);
    logger.debug("DONE PARSING");

    logger.debug("DEDUPING");
    const dedupedPlayers = uniqWith(parsedPlayers.filter(player => !!player), (player1, player2) => (player1.name === player2.name) && (player1.playerDataId === player2.playerDataId));

    return dao.batchUpsertPlayers(dedupedPlayers);
}

async function maybeDropMinorPlayers(dao: PlayerDAO, mode?: WriteMode) {
    if (mode === "overwrite") {
        try {
            logger.debug("overwrite, so deleting all minor league players");
            await dao.deleteAllPlayers("minor");
        } catch (e) {
            logger.error(inspect(e));
            throw e;
        }
    }
}

async function readAndParseMinorLeagueCsv(path: string, teams: Team[]): Promise<Partial<Player>[]> {
    const parsedPlayers: Partial<Player>[] = [];
    return new Promise((resolve, reject) => {
        logger.debug("----------- starting to read csv ----------");
        createReadStream(path)
            .pipe(csv.parse({headers: true}))
            .on("data", (row: PlayerCSVRow) => {
                const parsedPlayer = parseMinorLeaguePlayer(row, teams);
                if (parsedPlayer) {
                    parsedPlayers.push(parsedPlayer);
                }
                // logger.debug(`parsed: ${parsedPlayers.length}`);
            })
            .on("error", (e: any) => reject(e))
            .on("end", () => {
                logger.debug("~~~~~~ reached end of stream ~~~~~~~~~");
                resolve(parsedPlayers);
            });
    });
}

function parseMinorLeaguePlayer(row: PlayerCSVRow, teams: Team[]): Partial<Player>|undefined {
    const MINOR_LEAGUE_PLAYER_PROPS = ["Owner", "Player", "Position", "Team", "Level"];

    const validRow = validateRow(row, MINOR_LEAGUE_PLAYER_PROPS);
    if (!validRow) {
        logger.error(`Invalid row while parsing player csv row: ${inspect(row)}`);
        return undefined;
    }

    const ownedTeams = teams.filter(team => team.owners && team.owners.length);
    const leagueTeam = ownedTeams.find(team =>
        team.owners!.some(owner => owner.csvName === row.Owner));

    if (!leagueTeam) {
        logger.error(`No matching owners found while parsing player csv row: ${inspect(row)}`);
        return undefined;
    }

    return {
        name: row.Player,
        mlbTeam: row.Team,
        league: PlayerLeagueType.MINOR,
        leagueTeam,
        meta: { minorLeaguePlayer: { position: row.Position, minorLeagueLevel: row.Level } },
    };
}
