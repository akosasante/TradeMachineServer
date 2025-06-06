import { JsonController, Get } from "routing-controllers";

@JsonController("/health")
export class HealthCheckController {
    @Get("/")
    public async getHealth(): Promise<{ status: string; timestamp: number }> {
        return {
            status: "ok",
            timestamp: Date.now(),
        };
    }
}
