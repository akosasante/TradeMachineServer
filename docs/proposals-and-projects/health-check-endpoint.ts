// Implementation of a health check endpoint for Docker health checks
// This file should be placed in src/api/routes/

import { JsonController, Get } from "routing-controllers";
import { getRepository } from "typeorm";
import { User } from "../../models/user";
import { PrismaClient } from "@prisma/client";
import { redisClient } from "../../bootstrap/express";
import logger from "../../bootstrap/logger";

@JsonController("/health")
export class HealthCheckController {
    @Get("/")
    public async getHealth(): Promise<Record<string, unknown>> {
        const health = {
            uptime: process.uptime(),
            timestamp: Date.now(),
            status: "ok",
            checks: {
                database: { status: "pending", responseTime: 0 },
                prisma: { status: "pending", responseTime: 0 },
                redis: { status: "pending", responseTime: 0 }
            }
        };

        try {
            // TypeORM database check
            const startTypeOrm = Date.now();
            await getRepository(User).count();
            health.checks.database = { 
                status: "ok",
                responseTime: Date.now() - startTypeOrm
            };
        } catch (error) {
            logger.error("Health check - TypeORM database error:", error);
            health.checks.database = { 
                status: "error",
                responseTime: 0,
                error: error instanceof Error ? error.message : String(error)
            };
            health.status = "error";
        }

        try {
            // Prisma database check
            const prisma = new PrismaClient();
            const startPrisma = Date.now();
            await prisma.user.count();
            health.checks.prisma = { 
                status: "ok",
                responseTime: Date.now() - startPrisma
            };
            await prisma.$disconnect();
        } catch (error) {
            logger.error("Health check - Prisma database error:", error);
            health.checks.prisma = { 
                status: "error",
                responseTime: 0,
                error: error instanceof Error ? error.message : String(error)
            };
            health.status = "error";
        }

        try {
            // Redis check
            const startRedis = Date.now();
            const pingCommand = await redisClient.ping();
            health.checks.redis = { 
                status: pingCommand === "PONG" ? "ok" : "error",
                responseTime: Date.now() - startRedis,
                response: pingCommand
            };
            if (pingCommand !== "PONG") {
                health.status = "error";
            }
        } catch (error) {
            logger.error("Health check - Redis error:", error);
            health.checks.redis = { 
                status: "error",
                responseTime: 0,
                error: error instanceof Error ? error.message : String(error)
            };
            health.status = "error";
        }

        return health;
    }
}