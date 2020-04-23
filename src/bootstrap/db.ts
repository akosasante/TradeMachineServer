import { Connection, createConnection, getConnectionOptions } from "typeorm";
import util, { inspect } from "util";
import CustomQueryLogger from "../db/QueryLogger";
import logger from "./logger";

export default async function initializeDb(logQueries: boolean = false) {
    let connection: Connection|undefined;
    try {
        const dbConfigName = process.env.NODE_ENV;
        logger.debug(`secret: ${process.env.PG_USER}`);
        logger.debug(`GETTING CONNECTION OPTIONS: ${inspect(dbConfigName)}`);
        const connectionConfig = await getConnectionOptions(dbConfigName);
        logger.debug(`USING CONNECTION CONFIG: ${inspect(connectionConfig)}`);
        connection = await createConnection({
            ...connectionConfig,
            logger: logQueries ? new CustomQueryLogger(logger) : undefined,
        });
        logger.debug(`GOT CONNECTION: ${connection}`);
        const pgClient = (await connection.driver.obtainMasterConnection())[0];
        logger.debug(`OBTAINED MASTER CONNECTION: ${inspect(pgClient)}`);
        pgClient.on("error", (dbErr: any) => {
            logger.error(`DBERROR: ${inspect(dbErr)}`);
            setTimeout(async () => {
                try {
                    logger.error("Reconnecting to database...");
                    await connection!.close();
                    await connection!.connect();
                    logger.debug("Reconnected");
                } catch (reconnectError) {
                    logger.error("Reconnection error");
                    logger.error(reconnectError);
                }
            }, 5000);
        });

        pgClient.on("end", () => {
            logger.debug("PgClient ended");
        });

        return connection;
    } catch (error) {
        logger.error("Error while initializing db connection.");
        logger.error(util.inspect(error));
        logger.error(util.inspect(connection));
        throw error;
    }
}
