import { Express } from "express";
import "reflect-metadata";
import { useExpressServer } from "routing-controllers";
import { authorizationChecker, currentUserChecker } from "./auth";
import initializeDb from "./db";
import app from "./express";

export default async function(): Promise<Express> {
    // Set up db
    await initializeDb(process.env.NODE_ENV === "development");

    // Register routes and some global auth middlewares
    useExpressServer(app, {
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
    return app;
}
