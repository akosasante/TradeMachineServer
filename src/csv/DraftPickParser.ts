import csv from "fast-csv";
import * as fs from "fs";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import DraftPickDAO from "../DAO/DraftPickDAO";
import DraftPick from "../models/draftPick";
import { LeagueLevel } from "../models/player";
import Team from "../models/team";
import { validateRow, WriteMode } from "./CsvUtils";

interface DraftPickCSVRow {
    Owner: string;
    Round: string;
    "Pick Owner": string;
    Type: "Major"|"High"|"Low";
}

export async function processDraftPickCsv(csvFilePath: string, teams: Team[], dao: DraftPickDAO, mode?: WriteMode)
    : Promise<DraftPick[]> {
    const parsedPicks: Array<Partial<DraftPick>> = [];

    await maybeDeleteExistingPicks(dao, mode);

    logger.debug("WAITING ON STREAM");
    await readAndParsePickCsv(parsedPicks, csvFilePath, teams);
    logger.debug("DONE PARSING");

    return dao.batchCreatePicks(parsedPicks.filter(pick => !!pick));
}

async function maybeDeleteExistingPicks(dao: DraftPickDAO, mode?: WriteMode) {
    if (mode === "overwrite") {
        try {
            logger.debug("overwrite, so deleting all existing picks");
            await dao.deleteAllPicks();
        } catch (e) {
            logger.error(inspect(e));
            throw e;
        }
    }
}

async function readAndParsePickCsv(parsedPicks: Array<Partial<DraftPick>>, path: string, teams: Team[]) {
    return new Promise((resolve, reject) => {
        logger.debug("----------- starting to read csv ----------");
        fs.createReadStream(path)
            .pipe(csv.parse({headers: true}))
            .on("data", (row: DraftPickCSVRow) => {
                const parsedPick = parseDraftPick(row, teams);
                if (parsedPick) {
                    parsedPicks.push(parsedPick);
                }
                // logger.debug(`parsed: ${parsedPicks.length}, promised: ${promisedPicks.length}`);
            })
            .on("error", (e: any) => reject(e))
            .on("end", () => {
                logger.debug("~~~~~~ reached end of stream ~~~~~~~~~");
                resolve();
            });
    });
}

function parseDraftPick(row: DraftPickCSVRow, teams: Team[]): Partial<DraftPick>|undefined {
    const DRAFT_PICK_PROPS = ["Round", "Pick Owner", "Type", "Owner"];
    const KEYWORD_TO_LEVEL: {[key: string]: LeagueLevel} = {
        High: LeagueLevel.HIGH,
        Low: LeagueLevel.LOW,
        Major: LeagueLevel.MAJOR,
    };

    const validRow = validateRow(row, DRAFT_PICK_PROPS);
    if (!validRow) {
        return undefined;
    }
    const teamsWithOwners = teams.filter(team => team.owners && team.owners.length);
    const currentOwner = teamsWithOwners.find(team => team.owners!.some(owner => owner.shortName === row.Owner));
    const originalOwner = teamsWithOwners.find(team =>
        team.owners!.some(owner => owner.shortName === row["Pick Owner"]));

    if (!currentOwner || !originalOwner) {
        return undefined;
    }

    return {
        round: Number(row.Round),
        type: KEYWORD_TO_LEVEL[row.Type],
        currentOwner,
        originalOwner,
    };
}
