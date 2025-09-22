import * as promClient from "prom-client";
import { Controller, Get, Req, Res } from "routing-controllers";
import { Request, Response } from "express";
import { metricsRegistry } from "../../bootstrap/metrics";
import { getPrismaClientFromRequest } from "../../bootstrap/prisma-db";

@Controller("/metrics")
export default class MetricsController {
    private registry: promClient.Registry;

    constructor(registry: promClient.Registry) {
        this.registry = registry || metricsRegistry;
    }

    @Get("/")
    public async getMetrics(@Req() request: Request, @Res() response: Response): Promise<Response> {
        const metrics = await this.registry.metrics();

        const prisma = getPrismaClientFromRequest(request);
        if (prisma) {
            /* eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
            const prismaMetrics: string = await (prisma as any).$metrics.prometheus({
                globalLabels: {
                    app: "trade_machine",
                    environment: process.env.APP_ENV || "unknown",
                },
            });
            return response.contentType(this.registry.contentType).send(metrics + prismaMetrics);
        }

        return response.contentType(this.registry.contentType).send(metrics);
    }
}
