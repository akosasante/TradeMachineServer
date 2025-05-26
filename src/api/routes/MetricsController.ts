import * as promClient from "prom-client";
import { Controller, Get, Req, Res } from "routing-controllers";
import { Request, Response } from "express";
import { metricsRegistry } from "../../bootstrap/metrics";
import { ExpressAppSettings } from "../../bootstrap/express";
import logger from "../../bootstrap/logger";

@Controller("/metrics")
export default class MetricsController {
    private registry: promClient.Registry;

    constructor(registry: promClient.Registry) {
        this.registry = registry || metricsRegistry;
    }

    @Get("/")
    public async getMetrics(@Req() request: Request, @Res() response: Response): Promise<Response> {
        logger.info("Metrics endpoint hit");
        logger.info(request);

        const metrics = await this.registry.metrics();

        if (request?.app?.settings && "prisma" in (request.app.settings as Record<string, unknown>)) {
            const prisma = (request.app.settings as ExpressAppSettings).prisma;
            if (prisma) {
                const prismaMetrics: string = await prisma.$metrics.prometheus();
                return response.contentType(this.registry.contentType).send(metrics + prismaMetrics);
            }
        }

        logger.debug("No Prisma metrics found, returning only registry metrics");
        return response.contentType(this.registry.contentType).send(metrics);
    }
}
