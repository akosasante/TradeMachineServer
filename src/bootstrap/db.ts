import { createConnection, getConnectionOptions } from "typeorm";
import util from "util";
import CustomQueryLogger from "../db/QueryLogger";
import logger from "./logger";

export default async function initializeDb(logQueries: boolean = false) {
    let connection;
    try {
        const dbConfigName = process.env.NODE_ENV;
        const connectionConfig = await getConnectionOptions(dbConfigName);
        connection = await createConnection({
            ...connectionConfig,
            logger: logQueries ? new CustomQueryLogger(logger) : undefined,
        });
    } catch (error) {
        logger.error("Error while initializing db connection.");
        logger.error(error);
        logger.error(util.inspect(connection));
    }
}
