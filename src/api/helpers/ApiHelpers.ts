import { mkdirSync } from "fs";
import multer, { FileFilterCallback } from "multer";
import { FindOperator, IsNull, Not } from "typeorm";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import { Request } from "express";

const storage: multer.DiskStorageOptions = {
    destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        const dir = "/tmp/trade_machine_2_csvs";
        mkdirSync(dir, { recursive: true });
        return cb(null, dir);
    },
    filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) =>
        cb(null, `${file.fieldname} - ${Date.now()}.csv`),
};

export const fileUploadOptions = {
    storage: multer.diskStorage(storage),
    fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) =>
        cb(null, file.mimetype === "text/csv"),
    limits: { fieldNameSize: 255, fileSize: 1024 * 1024 * 2 },
};

export function cleanupQuery(initQuery: {
    [key: string]: string;
}): { [returned_key: string]: string | FindOperator<any> } {
    /* clone so that we don't cause weird stuff to
    inadvertently happen by mutating the original object */
    const query = { ...initQuery };
    const queryWithNull = coerceStringToNull(Object.entries(query)); // [[email, aaa], [name, none]]
    logger.debug(`queryWithNull: ${inspect(queryWithNull)}`);
    return queryWithNull;
}

export const UUID_PATTERN = "/:id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})";

function coerceStringToNull(kvps: [string, string][]) {
    return kvps.reduce((updatedQuery: { [key: string]: string | FindOperator<any> }, kvp: [string, string]) => {
        updatedQuery[kvp[0]] = isNullString(kvp[1]) ? IsNull() : isNotNullString(kvp[1]) ? Not(IsNull()) : kvp[1];
        return updatedQuery;
    }, {});
}

const isNullString = (str: string): boolean => str === "null" || str === "undefined";
const isNotNullString = (str: string): boolean =>
    str === "!null" || str === "!undefined" || str === "not null" || str === "not undefined";
