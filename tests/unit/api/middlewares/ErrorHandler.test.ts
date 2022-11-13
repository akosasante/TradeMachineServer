import { NextFunction, Request, Response } from "express";
import { HttpError } from "routing-controllers";
import { EntityMetadata, QueryFailedError } from "typeorm";
import { EntityPropertyNotFoundError } from "typeorm/error/EntityPropertyNotFoundError";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import CustomErrorHandler from "../../../../src/api/middlewares/ErrorHandler";
import logger from "../../../../src/bootstrap/logger";

describe("Error handler middleware", () => {
    // @ts-ignore
    const response: Response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    // @ts-ignore
    const request: Request = {};
    const next: NextFunction = jest.fn();
    const errorHandler = new CustomErrorHandler();

    beforeAll(() => {
        logger.debug("~~~~~~ERROR HANDLER MIDDLEWARE TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~ERROR HANDLER MIDDLEWARE TESTS COMPLETE~~~~~~");
    });
    afterEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
        Object.values(response).forEach(mockFn => mockFn.mockClear());
        (next as unknown as jest.Mock).mockReset();
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const errorObjectExpect = expect.objectContaining({ message: expect.any(String), stack: expect.any(String) });
    it("should send to next if the headers have already been sent", async () => {
        const error = new Error("generic error");
        // @ts-ignore
        const responseWithHeadersSent: Response = { ...response, headersSent: true };

        errorHandler.error(error, request, responseWithHeadersSent, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(error);
    });
    it("should call response with the status and error object if HTTP Error", async () => {
        const error = new HttpError(409, "generic error");

        errorHandler.error(error, request, response, next);
        expect(response.status).toHaveBeenCalledTimes(1);
        expect(response.json).toHaveBeenCalledTimes(1);
        expect(response.status).toHaveBeenCalledWith(error.httpCode);
        expect(response.json).toHaveBeenCalledWith(errorObjectExpect);
    });
    it("should call response with 404 and error object if EntityNotFoundError", async () => {
        const error = new EntityNotFoundError("User", "No matching ID found.");

        errorHandler.error(error, request, response, next);
        expect(response.status).toHaveBeenCalledTimes(1);
        expect(response.json).toHaveBeenCalledTimes(1);
        expect(response.status).toHaveBeenCalledWith(404);
        expect(response.json).toHaveBeenCalledWith(errorObjectExpect);
    });
    it("should call response with 400 and error object if QueryFailedError", async () => {
        const error = new QueryFailedError("queryString", [], {});

        errorHandler.error(error, request, response, next);
        expect(response.status).toHaveBeenCalledTimes(1);
        expect(response.json).toHaveBeenCalledTimes(1);
        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith(errorObjectExpect);
    });
    it("should call response with 400 and error object if EntityPropertyNotFoundError", async () => {
        const error = new EntityPropertyNotFoundError("User.name", {} as EntityMetadata);

        errorHandler.error(error, request, response, next);
        expect(response.status).toHaveBeenCalledTimes(1);
        expect(response.json).toHaveBeenCalledTimes(1);
        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith(errorObjectExpect);
    });
    it("should call response with 500 and error json in all other cases", async () => {
        const error = new Error("generic error");

        errorHandler.error(error, request, response, next);
        expect(response.status).toHaveBeenCalledTimes(1);
        expect(response.json).toHaveBeenCalledTimes(1);
        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith(expect.any(Error));
    });
});
