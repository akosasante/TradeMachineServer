import multer from "multer";
import { FindOperator, IsNull, Not } from "typeorm";
import { inspect } from "util";
import logger from "../bootstrap/logger";

const storage: multer.DiskStorageOptions = {
    destination: (req: any, file: any, cb: any) => cb(undefined, "/tmp/trade_machine_2_csvs"),
    filename: (req: any, file: any, cb: any) => cb(undefined, `${file.fieldname} - ${Date.now()}.csv`),
};

export const fileUploadOptions = {
    storage: multer.diskStorage(storage),
    fileFilter: (req: any, file: any, cb: any) => cb(undefined, file.mimetype === "text/csv"),
    limits: { fieldNameSize: 255, fileSize: 1024 * 1024 * 2 },
};

export function cleanupQuery(initQuery: {[key: string]: string}) {
    const query = {...initQuery}; // clone so that we don't cause weird stuff to inadvertently happen by
    // mutating the original object
    delete query.multiple; // Query param used for certain controllers but we don't want to pass it to the DAO
    const queryWithNull = coerceStringToNull(Object.entries(query)); // [[email, aaa], [name, none]]
    logger.debug(`queryWithNull: ${inspect(queryWithNull)}`);
    return queryWithNull;
}

function coerceStringToNull(kvps: Array<[string, string]>) {
    return kvps.reduce((updatedQuery: {[key: string]: string|FindOperator<any>}, kvp: [string, string]) => {
        // tslint:disable-next-line:no-null-keyword
        updatedQuery[kvp[0]] = isNullString(kvp[1]) ?
            IsNull() : (isNotNullString(kvp[1])) ?
                Not(IsNull()) : kvp[1];
        return updatedQuery;
    }, {});
}

const isNullString = (str: string): boolean => str === "null" || str === "undefined";
const isNotNullString = (str: string): boolean =>
    str === "!null" || str === "!undefined" || str === "not null" || str === "not undefined";
