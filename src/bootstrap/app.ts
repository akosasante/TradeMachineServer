import { Express } from "express";
import "reflect-metadata";
import { useExpressServer } from "routing-controllers";
import app from "./express";

export default async function(): Promise<Express> {
    // Register routes and some global auth middlewares
    useExpressServer(app, {
        cors: {
            origin: [/localhost:3000/],
            credentials: true,
        },
        controllers: [`${__dirname}/../api/routes/**`],
        defaultErrorHandler: false,
        middlewares: [`${__dirname}/../api/middlewares/**`],
    });
    return app;
}
