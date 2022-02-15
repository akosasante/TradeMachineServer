import { Express } from "express";
import "reflect-metadata";
import { useExpressServer } from "routing-controllers";
import { authorizationChecker, currentUserChecker } from "../authentication/auth";
import initializeDb from "./db";
import expressApp, { redisClient } from "./express";
import logger from "./logger";
import { inspect } from "util";
import { rollbar } from "./rollbar";
import { Server } from "http";

export async function setupExpressApp(): Promise<Express> {
    // Set up db
    logger.debug("setting up database");
    await initializeDb(process.env.DB_LOGS === "true");
    logger.debug("database setup complete");

    logger.debug("setting up consumers");
    const { setupEmailConsumers } = await import("../email/consumers");
    const { setupSlackConsumers } = await import("../slack/consumers");
    setupEmailConsumers();
    setupSlackConsumers();
    logger.debug("consumer setup complete");

    // Register routes and some global auth middlewares
    logger.debug("setting up route-controllers");
    const developmentOrigins = [/localhost:3000/, /localhost:8080/, /127\.0\.0\.1/, /ngrok/];
    const prodOrigins = [
        /newtrades\.akosua\.xyz/,
        /staging\.trades\.akosua\.xyz/,
        /trades\.akosua\.xyz/,
        /naughty-wozniak-9fc262\.netlify\.app/,
        /trades\.flexfoxfantasy\.com/,
    ];
    const allowedOrigins = prodOrigins.concat(process.env.NODE_ENV === "development" ? developmentOrigins : []);

    useExpressServer(expressApp, {
        classTransformer: true,
        cors: {
            origin: allowedOrigins,
            credentials: true,
        },
        controllers: [`${__dirname}/../api/routes/**`],
        defaultErrorHandler: false,
        middlewares: [`${__dirname}/../api/middlewares/**`],
        authorizationChecker,
        currentUserChecker,
    });
    logger.debug("route-controllers complete");
    return expressApp;
}

export default async function startServer(): Promise<Server> {
    try {
        await redisClient.connect();
        const app = await setupExpressApp();
        const srv = app.listen(app.get("port") as number, app.get("ip") as string, () => {
            logger.info(`App is running at ${app.get("ip")} : ${app.get("port")} in ${app.get("env")} mode`);
            logger.info("Press CTRL-C to stop\n");
            rollbar.info("server_started");
        });

        srv.on("error", err => {
            logger.error(`Server Error: ${inspect(err)}`);
        });

        srv.on("close", async () => {
            logger.debug("closing server");
            if (process.env.NODE_ENV !== "test") {
                await redisClient.quit();
            }
            logger.debug("server says bye!");
        });
        return srv;
    } catch (err) {
        logger.error(`fatal error when starting server: ${inspect(err)}`);
        rollbar.error(inspect(err));
        throw err;
    }
}
