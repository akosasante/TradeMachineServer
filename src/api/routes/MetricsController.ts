import * as promClient from "prom-client";
import { Controller, Get, Req, Res } from "routing-controllers";
import { Request, Response } from "express";
import { metricsRegistry } from "../../bootstrap/metrics";
import { ExpressAppSettings } from "../../bootstrap/express";

@Controller("/metrics")
export default class MetricsController {
    private registry: promClient.Registry;

    constructor(registry: promClient.Registry) {
        this.registry = registry || metricsRegistry;
    }

    @Get("/")
    public async getMetrics(@Req() request: Request, @Res() response: Response): Promise<Response> {
        const metrics = await this.registry.metrics();

        if (request?.app?.settings && "prisma" in (request.app.settings as Record<string, unknown>)) {
            const prisma = (request.app.settings as ExpressAppSettings).prisma;
            if (prisma) {
                const prismaMetrics: string = await prisma.$metrics.prometheus();
                return response.contentType(this.registry.contentType).send(metrics + prismaMetrics);
            }
        }

        return response.contentType(this.registry.contentType).send(metrics);
    }
}
