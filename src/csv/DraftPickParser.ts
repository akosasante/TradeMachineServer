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

let i = 0;
const season = 2020; // TODO: How to get these values from our CSVs. Maybe have some set aside cells; or force this as an attribute of the api call

export async function processDraftPickCsv(csvFilePath: string, teams: Team[], dao: DraftPickDAO, mode?: WriteMode)
    : Promise<DraftPick[]> {

    await maybeDeleteExistingPicks(dao, mode);

    logger.debug("WAITING ON STREAM");
    const parsedPicks = await readAndParsePickCsv(csvFilePath, teams);
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

async function readAndParsePickCsv(path: string, teams: Team[]): Promise<Partial<DraftPick>[]> {
    const parsedPicks: Partial<DraftPick>[] = [];
    return new Promise((resolve, reject) => {
        logger.debug("----------- starting to read csv ----------");
        fs.createReadStream(path)
            .pipe(csv.parse({headers: true}))
            .on("data", (row: DraftPickCSVRow) => {
                const parsedPick = parseDraftPick(row, teams, i);
                if (parsedPick) {
                    parsedPicks.push(parsedPick);
                }
                // logger.debug(`parsed: ${parsedPicks.length}, promised: ${promisedPicks.length}`);
            })
            .on("error", (e: any) => reject(e))
            .on("end", () => {
                logger.debug("~~~~~~ reached end of stream ~~~~~~~~~");
                resolve(parsedPicks);
            });
    });
}

function parseDraftPick(row: DraftPickCSVRow, teams: Team[], index: number): Partial<DraftPick>|undefined {
    // logger.debug(`INDEX=${index}`);
    const DRAFT_PICK_PROPS = ["Round", "Pick Owner", "Type", "Owner"];
    const KEYWORD_TO_LEVEL: {[key: string]: LeagueLevel} = {
        High: LeagueLevel.HIGH,
        Low: LeagueLevel.LOW,
        Major: LeagueLevel.MAJOR,
    };

    const validRow = validateRow(row, DRAFT_PICK_PROPS);
    if (!validRow) {
        logger.error(`Invalid row while parsing draft pick csv row: ${inspect(row)}`);
        return undefined;
    }
    const teamsWithOwners = teams.filter(team => team.owners && team.owners.length);
    const currentOwner = teamsWithOwners.find(team => team.owners!.some(owner => owner.csvName === row.Owner));
    const originalOwner = teamsWithOwners.find(team =>
        team.owners!.some(owner => owner.csvName === row["Pick Owner"]));

    if (!currentOwner || !originalOwner) {
        logger.error(`No matching owners found while parsing draft pick csv row: ${inspect(row)}`);
        return undefined;
    }
    i += 1;

    return {
        round: Number(row.Round),
        type: KEYWORD_TO_LEVEL[row.Type],
        currentOwner,
        originalOwner,
        season,
    };
}
