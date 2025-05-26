import * as promClient from "prom-client";
import { Controller, Get, Res } from "routing-controllers";
import { Response } from "express";
import { metricsRegistry } from "../../bootstrap/metrics";

@Controller("/metrics")
export default class MetricsController {
    private registry: promClient.Registry;

    constructor(registry: promClient.Registry) {
        this.registry = registry || metricsRegistry;
    }

    @Get("/")
    public async getMetrics(@Res() response: Response): Promise<Response> {
        const metrics = await this.registry.metrics();
        return response.contentType(this.registry.contentType).send(metrics);
    }
}
