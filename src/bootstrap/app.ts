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
import { createContext } from "../api/routes/v2/utils/context";
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
        // Primary domains
        /newtrades\.akosua\.xyz/,
        /trades\.flexfoxfantasy\.com/,
        // Staging/pre-prod domains for old frontend
        /staging\.trades\.akosua\.xyz/,
        /naughty-wozniak-9fc262\.netlify\.app/,
        // Staging/pre-prod domains for new frontend
        /ffftemp\.netlify\.app/,
        /ffftemp\.akosua\.xyz/,
        // old domain?
        /trades\.akosua\.xyz/,
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
        const tp = req.headers.traceparent;
        if (tp) {
            logger.debug(`[TRACE-DEBUG][INCOMING] method=${req.method} url=${req.url} traceparent=${tp}`);
        } else {
            logger.debug(`[TRACE-DEBUG][INCOMING] method=${req.method} url=${req.url} traceparent=none`);
        }
        next();
    });

    // Add CORS middleware for tRPC routes to handle OPTIONS requests
    const trpcCorsMiddleware = cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "traceparent"],
    });

    expressApp.use("/v2", (req, res, next) => {
        // conditional mount to avoid conflict with routing-controllers /v2 routes
        // tRPC uses dot notation (e.g., /auth.sessionCheck), so check for that pattern
        if (req.path.includes("auth.") || req.path.includes("client.")) {
            // Apply CORS first for tRPC routes
            trpcCorsMiddleware(req, res, () => {
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
            });
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
        try {
            await redisClient.connect();
            logger.info("Redis connection successful");
        } catch (redisError) {
            if (process.env.NODE_ENV === "test") {
                logger.warn(`Redis connection failed in test mode: ${inspect(redisError)}. Continuing anyway...`);
                // In test mode, try to connect but don't fail if it doesn't work
                // The connection might be established later or might not be needed
            } else {
                throw redisError;
            }
        }
        logger.info("Setting up Express app...");
        const app = await setupExpressApp();
        logger.info("Express app setup complete");
        const port = app.get("port") as number;
        const ip = app.get("ip") as string;
        logger.info(`Starting HTTP server on ${ip}:${port}`);

        const srv = await Promise.race<Server>([
            new Promise<Server>((resolve, reject) => {
                const server = app.listen(port, ip, () => {
                    logger.info(`App is running at ${ip} : ${port} in ${app.get("env")} mode`);
                    logger.info("Press CTRL-C to stop\n");
                    rollbar.info("server_started");
                    resolve(server);
                });

                server.on("error", (err: NodeJS.ErrnoException) => {
                    if (err.code === "EADDRINUSE") {
                        const errorMsg = `Port ${port} is already in use. Please stop the conflicting process or use a different port (e.g., set PORT env var).`;
                        logger.error(errorMsg);
                        reject(new Error(`${errorMsg}: ${err.message}`));
                    } else {
                        logger.error(`Server error during startup: ${inspect(err)}`);
                        reject(err);
                    }
                });
            }),
            new Promise<Server>((_, reject) => {
                setTimeout(() => {
                    reject(
                        new Error(
                            `Server startup timed out after 10 seconds. Port ${port} may be in use or Redis connection may be hanging.`
                        )
                    );
                }, 10000);
            }),
        ]);

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
