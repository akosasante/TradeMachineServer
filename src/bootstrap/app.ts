import { Express } from "express";
import "reflect-metadata";
import { useExpressServer } from "routing-controllers";
import { authorizationChecker, currentUserChecker } from "./auth";
import initializeDb from "./db";
import app from "./express";
import logger from "./logger";

export default async function(): Promise<Express> {
    // Set up db
    logger.debug("setting up database");
    await initializeDb(process.env.DB_LOGS === "true");
    logger.debug("database setup complete");

    // Register routes and some global auth middlewares
    logger.debug("setting up route-controllers");
    const developmentOrigins = [/localhost:3000/, /localhost:8080/, /127\.0\.0\.1/, /ngrok/];
    const prodOrigins: Array<string|RegExp> = [];
    const allowedOrigins = prodOrigins.concat(process.env.NODE_ENV === "development" ? developmentOrigins : []);

    useExpressServer(app, {
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
    return app;
}
