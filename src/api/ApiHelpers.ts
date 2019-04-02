import { inspect } from "util";
import logger from "../bootstrap/logger";

export function cleanupQuery(query: {[key: string]: string}) {
    const queryWithNull = coerceStringToNull(Object.entries(query)); // [[email, aaa], [name, none]]
    logger.debug(inspect(queryWithNull));
    return queryWithNull;
}

function coerceStringToNull(kvps: Array<[string, string]>) {
    return kvps.reduce((updatedQuery: {[key: string]: string|null}, kvp: [string, string]) => {
        // tslint:disable-next-line:no-null-keyword
        updatedQuery[kvp[0]] = (kvp[1] === "null" || kvp[1] === "undefined") ? null : kvp[1];
        return updatedQuery;
    }, {});
}
