import { Express } from "express";
import "reflect-metadata";
import { useExpressServer } from "routing-controllers";
import { authorizationChecker, currentUserChecker } from "../authentication/auth";
import initializeDb from "./db";
import initializePrisma, { ExtendedPrismaClient } from "./prisma-db";
import expressApp, { redisClient } from "./express";
import logger from "./logger";
import { inspect } from "util";
import { rollbar } from "./rollbar";
import { Server } from "http";
import { registerCleanupCallback, setupSignalHandlers } from "./shutdownHandler";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../api/routes/v2/router";
import { createContext } from "../api/routes/v2/context";
import cors from "cors";

export interface ExpressAppOptions {
    startTypeORM: boolean;
    startPrismaORM: boolean;
}

export async function setupExpressApp(
    opts: ExpressAppOptions = { startTypeORM: true, startPrismaORM: true }
): Promise<Express> {
    // Set up db
    logger.debug("setting up database");
    if (opts.startTypeORM) {
        logger.debug("setting up typeorm db");
        await initializeDb(process.env.DB_LOGS === "true");
    }
    if (opts.startPrismaORM) {
        logger.debug("setting up prisma db");
        const prisma: ExtendedPrismaClient = initializePrisma(true);
        expressApp.set("prisma", prisma);
        registerCleanupCallback(async () => {
            logger.debug("closing prisma connection");
            await prisma.$disconnect();
            logger.debug("prisma connection closed");
        });
    }
    logger.debug("database setup complete");

    logger.debug("setting up consumers");
    const { setupEmailConsumers } = await import("../email/consumers");
    const { setupSlackConsumers } = await import("../slack/consumers");
    setupEmailConsumers();
    setupSlackConsumers();
    logger.debug("consumer setup complete");

    // Register routes and some global auth middlewares
    logger.debug("setting up route-controllers");
    const developmentOrigins = [/localhost:3030/, /localhost:3031/, /127\.0\.0\.1/, /ngrok/];
    const prodOrigins = [
        /newtrades\.akosua\.xyz/,
        /staging\.trades\.akosua\.xyz/,
        /trades\.akosua\.xyz/,
        /naughty-wozniak-9fc262\.netlify\.app/,
        /trades\.flexfoxfantasy\.com/,
    ];
    const allowedOrigins = prodOrigins.concat(process.env.NODE_ENV === "development" ? developmentOrigins : []);

    // Set up tRPC v2 endpoints
    logger.debug("setting up tRPC v2 routes");
    // Fix malformed Content-Type headers before tRPC processing
    expressApp.use("/v2", (req, res, next) => {
        // Handle duplicate content-type headers that break Express JSON parsing
        if (req.headers["content-type"] && req.headers["content-type"].includes("application/json, application/json")) {
            req.headers["content-type"] = "application/json";
        }
        next();
    });

    // Add CORS middleware for tRPC routes to handle OPTIONS requests
    expressApp.use("/v2", (req, res, next) => {
        if (req.path.startsWith("/auth")) {
            cors({
                origin: allowedOrigins,
                credentials: true,
                methods: ["GET", "POST", "OPTIONS"],
                allowedHeaders: ["Content-Type", "Authorization", "traceparent"],
            })(req, res, next);
        } else {
            next();
        }
    });

    expressApp.use("/v2", (req, res, next) => {
        // conditional mount to avoid conflict with routing-controllers /v2 routes
        if (req.path.startsWith("/auth")) {
            createExpressMiddleware({
                router: appRouter,
                createContext,
                batching: {
                    enabled: true,
                },
                onError: ({ error, req: failedReq }) => {
                    logger.error(`tRPC Error: ${error.message}`, error);
                    rollbar.error(error, failedReq);
                },
            })(req, res, next);
        } else {
            next();
        }
    });
    logger.debug("tRPC v2 routes complete");

    useExpressServer(expressApp, {
        classTransformer: true,
        cors: {
            origin: allowedOrigins,
            credentials: true,
        },
        controllers: [
            `${__dirname}/../api/routes/*Controller.{ts,js}`,
            `${__dirname}/../api/routes/v2/*Controller.{ts,js}`,
        ],
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
        logger.info("=== Starting server initialization ===");
        logger.info(
            `Redis client configuration: host=${process.env.REDIS_IP || "localhost"}, port=${
                process.env.REDIS_PORT || 6379
            }`
        );
        logger.info("Attempting to connect to Redis...");
        await redisClient.connect();
        logger.info("Redis connection successful");
        logger.info("Setting up Express app...");
        const app = await setupExpressApp();
        logger.info("Express app setup complete");
        logger.info(`Starting HTTP server on ${app.get("ip")}:${app.get("port")}`);
        const srv = app.listen(app.get("port") as number, app.get("ip") as string, () => {
            logger.info(`App is running at ${app.get("ip")} : ${app.get("port")} in ${app.get("env")} mode`);
            logger.info("Press CTRL-C to stop\n");
            rollbar.info("server_started");
        });

        redisClient.on("error", (err: Error) => {
            logger.error(`Redis Client Error: ${inspect(err)}`);
        });

        redisClient.on("connect", (...args) => {
            logger.info(`Redis Client Connected Successfully: ${inspect(args)}`);
        });

        redisClient.on("ready", (...args) => {
            logger.info(`Redis Client Ready: ${inspect(args)}`);
        });

        redisClient.on("end", (...args) => {
            logger.info(`Redis Client Connection Ended: ${inspect(args)}`);
        });

        redisClient.on("reconnecting", (...args) => {
            logger.info(`Redis Client Reconnecting: ${inspect(args)}`);
        });

        srv.on("error", err => {
            logger.error(`Server Error: ${inspect(err)}`);
        });

        srv.on("close", () => {
            const serverCloseHandler = async () => {
                logger.info("closing server");
                if (process.env.NODE_ENV !== "test") {
                    await redisClient.quit();
                }
                logger.debug("server says bye!");
            };
            serverCloseHandler().catch(logger.error);
        });

        registerCleanupCallback(() => {
            logger.info("cleanup callback called, closing server");
            return new Promise<void>(resolve => {
                if (!srv || !srv.listening) {
                    resolve();
                }
                return srv.close(err => {
                    if (err) {
                        logger.error(`Error closing server: ${inspect(err)}`);
                    }
                    resolve();
                });
            });
        });

        setupSignalHandlers();
        return srv;
    } catch (err) {
        logger.error(`fatal error when starting server: ${inspect(err)}`);
        rollbar.error(inspect(err));
        throw err;
    }
}
