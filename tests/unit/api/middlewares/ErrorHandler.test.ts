import { NextFunction, Request, Response } from "express";
import "jest";
import "jest-extended";
import { HttpError } from "routing-controllers";
import { QueryFailedError } from "typeorm";
import { EntityColumnNotFound } from "typeorm/error/EntityColumnNotFound";
import { EntityNotFoundError } from "typeorm/error/EntityNotFoundError";
import CustomErrorHandler from "../../../../src/api/middlewares/ErrorHandler";

describe("Error handler middleware", () => {
    const errorObjectExpect = expect.objectContaining({message: expect.any(String), stack: expect.any(String)});
    it("should send to next if the headers have already been sent", async () => {
        const error = new Error("generic error");
        // @ts-ignore
        const request: Request = {};
        // @ts-ignore
        const response: Response = { headersSent: true };
        const next: NextFunction = jest.fn();
        const errorHandler = new CustomErrorHandler();

        await errorHandler.error(error, request, response, next);
        expect(next).toBeCalledTimes(1);
        expect(next).toBeCalledWith(error);
    });
    it("should call response with the status and error object if HTTP Error", async () => {
        const error = new HttpError(409, "generic error");
        // @ts-ignore
        const request: Request = {};
        // @ts-ignore
        const response: Response = {
            status: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
            json: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
        };
        const next: NextFunction = () => undefined;
        const errorHandler = new CustomErrorHandler();

        await errorHandler.error(error, request, response, next);
        expect(response.status).toHaveBeenCalledTimes(1);
        expect(response.json).toHaveBeenCalledTimes(1);
        expect(response.status).toHaveBeenCalledWith(error.httpCode);
        expect(response.json).toHaveBeenCalledWith(errorObjectExpect);
    });
    it("should call response with 404 and error object if EntityNotFoundError", async () => {
        const error = new EntityNotFoundError("User", "No matching ID found.");
        // @ts-ignore
        const request: Request = {};
        // @ts-ignore
        const response: Response = {
            status: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
            json: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
        };
        const next: NextFunction = () => undefined;
        const errorHandler = new CustomErrorHandler();

        await errorHandler.error(error, request, response, next);
        expect(response.status).toHaveBeenCalledTimes(1);
        expect(response.json).toHaveBeenCalledTimes(1);
        expect(response.status).toHaveBeenCalledWith(404);
        expect(response.json).toHaveBeenCalledWith(errorObjectExpect);
    });
    it("should call response with 400 and error object if QueryFailedError", async () => {
        const error = new QueryFailedError("queryString", [], {});
        // @ts-ignore
        const request: Request = {};
        // @ts-ignore
        const response: Response = {
            status: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
            json: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
        };
        const next: NextFunction = () => undefined;
        const errorHandler = new CustomErrorHandler();

        await errorHandler.error(error, request, response, next);
        expect(response.status).toHaveBeenCalledTimes(1);
        expect(response.json).toHaveBeenCalledTimes(1);
        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith(errorObjectExpect);
    });
    it("should call response with 400 and error object if EntityColumnNotFound", async () => {
        const error = new EntityColumnNotFound("User.name");
        // @ts-ignore
        const request: Request = {};
        // @ts-ignore
        const response: Response = {
            status: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
            json: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
        };
        const next: NextFunction = () => undefined;
        const errorHandler = new CustomErrorHandler();

        await errorHandler.error(error, request, response, next);
        expect(response.status).toHaveBeenCalledTimes(1);
        expect(response.json).toHaveBeenCalledTimes(1);
        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith(errorObjectExpect);
    });
    it("should call response with 500 and error json in all other  cases", async () => {
        const error = new Error("generic error");
        // @ts-ignore
        const request: Request = {};
        // @ts-ignore
        const response: Response = {
            status: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
            json: jest.fn(function() {
                // @ts-ignore
                return this;
            }),
        };
        const next: NextFunction = () => undefined;
        const errorHandler = new CustomErrorHandler();

        await errorHandler.error(error, request, response, next);
        expect(response.status).toHaveBeenCalledTimes(1);
        expect(response.json).toHaveBeenCalledTimes(1);
        expect(response.status).toHaveBeenCalledWith(500);
        expect(response.json).toHaveBeenCalledWith(expect.any(Error));
    });
});
