import csv from "fast-csv";
import * as fs from "fs";
import { inspect } from "util";
import logger from "../bootstrap/logger";
import DraftPickDAO from "../DAO/DraftPickDAO";
import DraftPick from "../models/draftPick";
import { LeagueLevel } from "../models/player";
import User from "../models/user";
import { validateRow, WriteMode } from "./CsvUtils";

interface DraftPickCSVRow {
    Owner: string;
    Round: string;
    "Pick Owner": string;
    Type: "Major"|"High"|"Low";
}

export async function processDraftPickCsv(csvFilePath: string, users: User[], dao: DraftPickDAO, mode?: WriteMode) {
    let parsedPicks: Array<Partial<DraftPick>> = [];
    let promisedPicks: Array<Promise<DraftPick[]>> = [];

    if (mode === "overwrite") {
        try {
            await dao.deleteAllPicks();
        } catch (e) {
            logger.error(inspect(e));
            throw e;
        }
    }

    const promisedStream = new Promise((resolve, reject) => {
        logger.debug("----------- starting to read csv ----------");
        fs.createReadStream(csvFilePath)
            .pipe(csv.parse({headers: true}))
            .on("data", (row: DraftPickCSVRow) => {
                [parsedPicks, promisedPicks] = parseDraftPicks(row, parsedPicks, promisedPicks, users, dao);
                // logger.debug(`parsed: ${parsedPicks.length}, promised: ${promisedPicks.length}`);
            })
            .on("error", (e: any) => reject(e))
            .on("end", () => {
                logger.debug("~~~~~~ reached end of stream ~~~~~~~~~");
                resolve();
            });
    });

    return promisedStream.then(() => {
        promisedPicks.push(dao.batchCreatePicks(parsedPicks.splice(0)));
        return Promise.all(promisedPicks).then(draftPicks => {
            // @ts-ignore typescript does not seem to know about "flat"
            return draftPicks.flat().filter(pick => !!pick);
        });
    });
}

function parseDraftPicks(row: DraftPickCSVRow, parsedPicks: Array<Partial<DraftPick>>,
                         promisedPicks: Array<Promise<DraftPick[]>>, users: User[], dao: DraftPickDAO):
    [Array<Partial<DraftPick>>, Array<Promise<DraftPick[]>>] {
    const parsed = Array.from(parsedPicks);
    const promised = Array.from(promisedPicks);

    const parsedRow: Partial<DraftPick>|undefined = parseDraftPick(row, users);

    if (parsedRow) {
        parsed.push(parsedRow);
    }
    if (parsed.length >= 50) {
        promised.push(dao.batchCreatePicks(parsed.splice(0)));
    }
    return [parsed, promised];
}

function parseDraftPick(row: DraftPickCSVRow, users: User[]): Partial<DraftPick>|undefined {
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
    const currentOwner = users.find(user => user.shortName === row.Owner);
    const originalOwner = users.find(user => user.shortName === row["Pick Owner"]);

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
