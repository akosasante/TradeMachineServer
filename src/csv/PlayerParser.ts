import csv from "fast-csv";
import * as fs from "fs";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import PlayerDAO from "../DAO/PlayerDAO";
import Player, { LeagueLevel } from "../models/player";
import Team from "../models/team";
import { validateRow, WriteMode } from "./CsvUtils";

interface PlayerCSVRow {
    Owner: string;
    Player: string;
    Position: string;
    Team: string;
    Level: "High"|"Low";
}

export async function processMinorLeagueCsv(csvFilePath: string, teams: Team[], dao: PlayerDAO, mode?: WriteMode)
    : Promise<Player[]> {
    const parsedPlayers: Array<Partial<Player>> = [];

    await maybeDropMinorPlayers(dao, mode);

    logger.debug("WAITING ON STREAM");
    await readAndParseMinorLeagueCsv(parsedPlayers, csvFilePath, teams);
    logger.debug("READY");

    return dao.batchCreatePlayers(parsedPlayers.filter(player => !!player));
}

async function maybeDropMinorPlayers(dao: PlayerDAO, mode?: WriteMode) {
    if (mode === "overwrite") {
        try {
            await dao.deleteAllPlayers("minor");
        } catch (e) {
            logger.error(inspect(e));
            throw e;
        }
    }
}

async function readAndParseMinorLeagueCsv(parsedPlayers: Array<Partial<Player>>,
                                          path: string, teams: Team[]) {
    return new Promise((resolve, reject) => {
        logger.debug("----------- starting to read csv ----------");
        fs.createReadStream(path)
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
                resolve();
            });
    });
}

function parseMinorLeaguePlayer(row: PlayerCSVRow, teams: Team[]): Partial<Player>|undefined {
    const MINOR_LEAGUE_PLAYER_PROPS = ["Owner", "Player", "Position", "Team", "Level"];
    const LEVEL_TO_LEAGUE: {[key: string]: LeagueLevel} = {
        High: LeagueLevel.HIGH,
        Low: LeagueLevel.LOW,
    };

    const validRow = validateRow(row, MINOR_LEAGUE_PLAYER_PROPS);
    if (!validRow) {
        return undefined;
    }

    const ownedTeams = teams.filter(team => team.owners && team.owners.length);
    const leagueTeam = ownedTeams.find(team => team.owners!.some(owner => owner.shortName === row.Owner));

    if (!leagueTeam) {
        return undefined;
    }

    return {
        name: row.Player,
        mlbTeam: row.Team,
        league: LEVEL_TO_LEAGUE[row.Level],
        leagueTeam,
        meta: {position: row.Position},
    };
}
