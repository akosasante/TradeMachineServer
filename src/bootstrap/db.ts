import { Connection, createConnection, getConnectionOptions } from "typeorm";
import util, { inspect } from "util";
import CustomQueryLogger from "../db/QueryLogger";
import logger from "./logger";
import { rollbar } from "./rollbar";

export default async function initializeDb(logQueries = false): Promise<Connection> {
    let connection: Connection | undefined;
    try {
        const dbConfigName = process.env.ORM_CONFIG;
        const connectionConfig = await getConnectionOptions(dbConfigName);
        connection = await createConnection({
            ...connectionConfig,
            logger: logQueries ? new CustomQueryLogger(logger) : undefined,
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        const pgClient = (await connection.driver.obtainMasterConnection())[0];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        pgClient.on("error", (dbErr: any) => {
            logger.error(`DBERROR: ${inspect(dbErr)}`);
            rollbar.error(`DBERROR: ${inspect(dbErr)}`);
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            setTimeout(async () => {
                try {
                    logger.error("Reconnecting to database...");
                    rollbar.error("Reconnecting to database...");
                    await connection!.close();
                    await connection!.connect();
                    logger.debug("Reconnected");
                } catch (reconnectError) {
                    logger.error("Reconnection error");
                    logger.error(reconnectError);
                    rollbar.error(reconnectError);
                }
            }, 5000);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        pgClient.on("end", () => {
            logger.debug("PgClient ended");
        });

        return connection;
    } catch (error) {
        logger.error("Error while initializing db connection.");
        logger.error(util.inspect(error));
        logger.error(util.inspect(connection));
        rollbar.error(error);
        throw error;
    }
}
