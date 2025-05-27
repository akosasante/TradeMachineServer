import MetricsController from "../../../../../src/api/routes/MetricsController";
import * as promClient from "prom-client";
import { Request, Response, Express } from "express";
import logger from "../../../../../src/bootstrap/logger";

describe("MetricsController", () => {
    // Create mocks
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockRegistry: Partial<promClient.Registry>;
    let mockPrismaClient: any;
    let metricsController: MetricsController;

    beforeAll(() => {
        logger.debug("~~~~~~METRICS CONTROLLER TESTS BEGIN~~~~~~");
    });

    afterAll(() => {
        logger.debug("~~~~~~METRICS CONTROLLER TESTS COMPLETE~~~~~~");
    });

    beforeEach(() => {
        // Mock the metrics registry and its methods
        mockRegistry = {
            metrics: jest.fn().mockResolvedValue("node_metrics_data"),
            contentType: "text/plain; version=0.0.4; charset=utf-8",
        };

        // Mock the response object
        mockResponse = {
            contentType: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };

        // Create controller with mocked registry
        metricsController = new MetricsController(mockRegistry as promClient.Registry);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should return metrics without Prisma metrics when prisma is not available", async () => {
        // Mock request without Prisma in app settings
        mockRequest = {} as Request;

        // Call the getMetrics method with mock request and response objects
        await metricsController.getMetrics(mockRequest as Request, mockResponse as Response);

        // Verify registry.metrics() was called
        expect(mockRegistry.metrics).toHaveBeenCalled();

        // Verify response was sent with correct content type
        expect(mockResponse.contentType).toHaveBeenCalledWith(mockRegistry.contentType);
        expect(mockResponse.send).toHaveBeenCalledWith("node_metrics_data");
    });

    it("should include Prisma metrics when prisma is available", async () => {
        // Create mock prisma client with metrics
        mockPrismaClient = {
            $metrics: {
                prometheus: jest.fn().mockResolvedValue("prisma_metrics_data"),
            },
        };

        // Create mock Express app with prisma in settings
        const mockApp = {} as Express;
        Object.defineProperty(mockApp, "settings", {
            value: {
                prisma: mockPrismaClient,
            },
            configurable: true,
        });

        // Mock request with Prisma in app settings
        mockRequest = {
            app: mockApp,
        } as unknown as Request;

        // Call the getMetrics method with mock request and response objects
        await metricsController.getMetrics(mockRequest as Request, mockResponse as Response);

        // Verify registry.metrics() was called
        expect(mockRegistry.metrics).toHaveBeenCalled();

        // Verify prisma metrics were fetched
        expect(mockPrismaClient.$metrics.prometheus).toHaveBeenCalled();

        // Verify response was sent with correct content type and combined metrics
        expect(mockResponse.contentType).toHaveBeenCalledWith(mockRegistry.contentType);
        expect(mockResponse.send).toHaveBeenCalledWith("node_metrics_data" + "prisma_metrics_data");
    });
});
