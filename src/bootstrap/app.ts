import { Express } from "express";
import "reflect-metadata";
import { useExpressServer } from "routing-controllers";
import { authorizationChecker, currentUserChecker } from "./auth";
import initializeDb from "./db";
import app from "./express";
import logger from "./logger";

export default async function(): Promise<Express> {
    try {
        // Set up db
        logger.debug("setting up database");
        await initializeDb(process.env.ENABLE_LOGS === "true");
        logger.debug("database setup complete");

        // Register routes and some global auth middlewares
        logger.debug("setting up route-controllers");
        useExpressServer(app, {
            classTransformer: true,
            cors: {
                origin: [/localhost:3000/],
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
    } catch (error) {
        throw error;
    }
}
