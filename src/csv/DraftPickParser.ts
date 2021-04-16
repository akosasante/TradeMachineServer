import { parseFile } from "@fast-csv/parse";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import DraftPickDAO from "../DAO/DraftPickDAO";
import DraftPick, { LeagueLevel } from "../models/draftPick";
import Team from "../models/team";
import { validateRow, WriteMode } from "./CsvUtils";
import { uniqWith } from "lodash";
import { rollbar } from "../bootstrap/rollbar";

interface DraftPickCSVRow {
    Owner: string;
    Round: string;
    "Pick Owner": string;
    Type: "Major"|"High"|"Low";
    "Pick Number": string | undefined;
}

let i = 0;
const season = 2021; // TODO: How to get these values from our CSVs. Maybe have some set aside cells; or force this as an attribute of the api call

// TODO: Perhaps csv names should be associated with teams rather than users??

export async function processDraftPickCsv(csvFilePath: string, teams: Team[], dao: DraftPickDAO, mode?: WriteMode)
    : Promise<DraftPick[]> {

    await maybeDeleteExistingPicks(dao, mode);

    logger.debug(`WAITING ON STREAM ${csvFilePath}`);
    const parsedPicks = await readAndParsePickCsv(csvFilePath, teams);
    logger.debug("DONE PARSING");

    logger.debug("deduping list of picks");
    const dedupedPicks = uniqWith(parsedPicks, (pick1, pick2) =>
        (pick1.type === pick2.type) &&
        (pick1.season === pick2.season) &&
        (pick1.round === pick2.round) &&
        (pick1.originalOwner === pick2.originalOwner)
    );
    logger.debug(`deduped from ${parsedPicks.length} to ${dedupedPicks.length}`);
    return dao.batchUpsertPicks(dedupedPicks.filter(pick => !!pick));
}

async function maybeDeleteExistingPicks(dao: DraftPickDAO, mode?: WriteMode) {
    if (mode === "overwrite") {
        try {
            logger.debug("overwrite, so deleting all existing picks");
            await dao.deleteAllPicks();
        } catch (e) {
            logger.error(inspect(e));
            rollbar.error(e);
            throw e;
        }
    }
}

async function readAndParsePickCsv(path: string, teams: Team[]): Promise<Partial<DraftPick>[]> {
    const parsedPicks: Partial<DraftPick>[] = [];
    return new Promise((resolve, reject) => {
        logger.debug("----------- starting to read csv ----------");
        parseFile(path, {headers: true})
            .on("data", (row: DraftPickCSVRow) => {
                const parsedPick = parseDraftPick(row, teams, i);
                if (parsedPick) {
                    parsedPicks.push(parsedPick);
                }
                // logger.debug(`parsed: ${parsedPicks.length}, promised: ${promisedPicks.length}`);
            })
            .on("error", (e: any) => reject(e))
            .on("end", (rowCount: number) => {
                logger.debug(`~~~~~~ reached end of stream. parsed ${rowCount} rows ~~~~~~~~~`);
                resolve(parsedPicks);
            });
    });
}

function parseDraftPick(row: DraftPickCSVRow, teams: Team[], index: number): Partial<DraftPick>|undefined {
    // logger.debug(`INDEX=${index}`);
    const DRAFT_PICK_REQUIRED_PROPS = ["Round", "Pick Owner", "Type", "Owner"];
    const KEYWORD_TO_LEVEL: {[key: string]: LeagueLevel} = {
        High: LeagueLevel.HIGH,
        Low: LeagueLevel.LOW,
        Major: LeagueLevel.MAJORS,
    };

    const validRow = validateRow(row, DRAFT_PICK_REQUIRED_PROPS);
    if (!validRow) {
        logger.error(`Invalid row while parsing draft pick csv row: ${inspect(row)}`);
        rollbar.error(`Invalid row while parsing draft pick csv row: ${inspect(row)}`);
        return undefined;
    }
    const teamsWithOwners = teams.filter(team => team.owners && team.owners.length);
    const currentOwner = teamsWithOwners.find(team => team.owners!.some(owner => owner.csvName === row.Owner));
    const originalOwner = teamsWithOwners.find(team =>
        team.owners!.some(owner => owner.csvName === row["Pick Owner"]));

    if (!currentOwner || !originalOwner) {
        logger.error(`No matching owners found while parsing draft pick csv row: ${inspect(row)}`);
        rollbar.error(`No matching owners found while parsing draft pick csv row: ${inspect(row)}`);
        return undefined;
    }
    i += 1;

    return {
        round: Number(row.Round),
        type: KEYWORD_TO_LEVEL[row.Type],
        currentOwner,
        originalOwner,
        season,
        pickNumber: row["Pick Number"] ? parseFloat(row["Pick Number"]) : undefined,
    };
}
