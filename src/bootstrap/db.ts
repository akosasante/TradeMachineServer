import { Connection, ConnectionOptionsReader, createConnection } from "typeorm";
import { inspect } from "util";
import CustomQueryLogger from "../db/QueryLogger";
import { UuidSubscriber } from "../db/subscribers/UuidSubscriber";
import logger from "./logger";
import { rollbar } from "./rollbar";

export default async function initializeDb(logQueries = false): Promise<Connection> {
    let connection: Connection | undefined;
    try {
        logger.debug(`Connecting to ORM config: ${process.env.ORM_CONFIG}`);
        const dbConfigName = process.env.ORM_CONFIG || "";
        const connectionConfig = await new ConnectionOptionsReader({ root: process.cwd() }).get(dbConfigName);
        logger.info(`DB Connection options: ${inspect(connectionConfig, { depth: 2 })}`);

        connection = await createConnection({
            ...connectionConfig,
            logger: logQueries ? new CustomQueryLogger(logger) : undefined,
            subscribers: [UuidSubscriber], // Explicitly register UUID subscriber (overrides config)
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        const pgClient = (await connection.driver.obtainMasterConnection())[0];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        pgClient.on("error", (dbErr: any) => {
            logger.error(`DBERROR: ${inspect(dbErr)}`);
            rollbar.error(`DBERROR: ${inspect(dbErr)}`);

            setTimeout(() => {
                const connectionHandler = async () => {
                    logger.error("Reconnecting to database...");
                    rollbar.error("Reconnecting to database...");
                    await connection!.close();
                    await connection!.connect();
                    logger.debug("Reconnected");
                };

                connectionHandler().catch(reconnectError => {
                    logger.error("Reconnection error");
                    logger.error(reconnectError);
                    rollbar.error(inspect(reconnectError));
                });
            }, 5000);
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        pgClient.on("end", () => {
            logger.debug("PgClient ended");
        });

        return connection;
    } catch (error) {
        logger.error("Error while initializing db connection.");
        logger.error(inspect(error));
        logger.error(inspect(connection));
        rollbar.error(inspect(error));
        throw error;
    }
}
