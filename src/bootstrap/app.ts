import { Express } from "express";
import "reflect-metadata";
import { useExpressServer } from "routing-controllers";
import { createMailQueue, MailQueue } from "../queue/mailQueue";
import { authorizationChecker, currentUserChecker } from "./auth";
import initializeDb from "./db";
import app from "./express";
import logger from "./logger";

export let mailQueue: MailQueue|undefined;

export default async function(): Promise<Express> {
    // Set up db
    logger.debug("setting up database");
    await initializeDb(process.env.ENABLE_LOGS === "true");
    logger.debug("database setup complete");

    logger.debug("setting up mail queue");
    mailQueue = await createMailQueue();
    logger.debug("mail queue setup complete");

    // Register routes and some global auth middlewares
    logger.debug("setting up route-controllers");
    const developmentOrigins = [/localhost:3000/, /localhost:8080/];
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
