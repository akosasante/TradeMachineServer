import { Get, HttpError, JsonController, Req } from "routing-controllers";
import logger from "../../bootstrap/logger";
import { redisClient } from "../../bootstrap/express";
import { promisify } from "util";
import { Request } from "express";
import { getConnection } from "typeorm";
import { getPrismaClientFromRequest } from "../../bootstrap/prisma-db";
import User from "../../models/user";

interface CheckResponse {
    status: string;
    responseTime: number;
    error?: string;
    response?: string;
}

interface HealthResponse {
    uptime: number;
    timestamp: number;
    status: string;
    checks: {
        database: CheckResponse;
        prisma: CheckResponse;
        redis: CheckResponse;
    };
}

@JsonController("/health")
export class HealthCheckController {
    @Get("/")
    public async getHealth(@Req() request?: Request): Promise<HealthResponse> {
        const health: HealthResponse = {
            uptime: process.uptime(),
            timestamp: Date.now(),
            status: "ok",
            checks: {
                database: { status: "pending", responseTime: 0 },
                prisma: { status: "pending", responseTime: 0 },
                redis: { status: "pending", responseTime: 0 },
            },
        };
        try {
            const prisma = getPrismaClientFromRequest(request);
            if (!prisma) {
                throw new Error("Prisma client not found in express app settings!");
            }
            const startPrisma = Date.now();
            await prisma.user.count();
            health.checks.prisma = {
                status: "ok",
                responseTime: Date.now() - startPrisma,
            };
        } catch (error) {
            logger.error("Health check - Prisma database error:", error);
            health.checks.prisma = {
                status: "error",
                responseTime: 0,
                error: error instanceof Error ? error.message : String(error),
            };
            health.status = "error";
        }

        try {
            const startRedis = Date.now();
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            const pingAsync = promisify<() => Promise<string>>(redisClient.ping).bind(redisClient);
            const pingResponse = await pingAsync();
            health.checks.redis = {
                status: pingResponse === "PONG" ? "ok" : "error",
                responseTime: Date.now() - startRedis,
                response: pingResponse,
            };
            if (pingResponse !== "PONG") {
                health.status = "error";
                health.checks.redis.error = "Redis ping returned: " + pingResponse;
            }
        } catch (error) {
            logger.error("Health check - Redis error:", error);
            health.checks.redis = {
                status: "error",
                responseTime: 0,
                error: error instanceof Error ? error.message : String(error),
            };
            health.status = "error";
        }

        try {
            // TypeORM database check
            const startTypeOrm = Date.now();
            await getConnection(process.env.ORM_CONFIG).getRepository(User).count();
            health.checks.database = {
                status: "ok",
                responseTime: Date.now() - startTypeOrm,
            };
        } catch (error) {
            logger.error("Health check - TypeORM database error:", error);
            health.checks.database = {
                status: "error",
                responseTime: 0,
                error: error instanceof Error ? error.message : String(error),
            };
            health.status = "error";
        }

        if (health.status === "ok") {
            return health;
        } else {
            const errors = Object.values(health.checks)
                .map(check => check.error)
                .filter(Boolean);
            throw new HttpError(503, `Service Unavailable: ${errors.length ? errors : "One or more checks failed"}`);
        }
    }
}
