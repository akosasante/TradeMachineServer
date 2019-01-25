import { Express } from "express";
import passport = require("passport");
import "reflect-metadata";
import { Action, useExpressServer } from "routing-controllers";
import { Role } from "../models/user";
import { authorizationChecker, currentUserChecker } from "./auth";
import app from "./express";
import logger from "./logger";

export const PassportAuth = passport;

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
        authorizationChecker,
        currentUserChecker,
    });
    return app;
}
