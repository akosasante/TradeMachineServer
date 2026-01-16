import { Request } from "express";
import { isNetlifyOrigin } from "../../../../../src/api/middlewares/CookieDomainHandler";

describe("CookieDomainHandler", () => {
    describe("isNetlifyOrigin", () => {
        it("should return true for https://staging--ffftemp.netlify.app from Origin header", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return "https://staging--ffftemp.netlify.app";
                    }
                    return undefined;
                }),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(true);
        });

        it("should return true for https://ffftemp.akosua.xyz from Origin header", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return "https://ffftemp.akosua.xyz";
                    }
                    return undefined;
                }),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(true);
        });

        it("should return true for https://staging--ffftemp.netlify.app/ from Origin header (with trailing slash)", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return "https://staging--ffftemp.netlify.app/";
                    }
                    return undefined;
                }),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(true);
        });

        it("should return true for https://ffftemp.akosua.xyz/login from Origin header (with path)", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return "https://ffftemp.akosua.xyz/login";
                    }
                    return undefined;
                }),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(true);
        });

        it("should return true for https://staging--ffftemp.netlify.app from Referer header when Origin is missing", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return undefined;
                    }
                    if (header === "Referer") {
                        return "https://staging--ffftemp.netlify.app";
                    }
                    return undefined;
                }),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(true);
        });

        it("should return true for https://ffftemp.akosua.xyz from Referer header when Origin is missing", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return undefined;
                    }
                    if (header === "Referer") {
                        return "https://ffftemp.akosua.xyz";
                    }
                    return undefined;
                }),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(true);
        });

        it("should return false for https://staging.trades.akosua.xyz from Origin header", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return "https://staging.trades.akosua.xyz";
                    }
                    return undefined;
                }),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(false);
        });

        it("should return false for https://trades.flexfoxfantasy.com from Origin header", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return "https://trades.flexfoxfantasy.com";
                    }
                    return undefined;
                }),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(false);
        });

        it("should return false when both Origin and Referer headers are missing", () => {
            const mockReq = {
                get: jest.fn(() => undefined),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(false);
        });

        it("should return false for invalid URL in Origin header", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return "not-a-valid-url";
                    }
                    return undefined;
                }),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(false);
        });

        it("should handle Referer with query params and path", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return undefined;
                    }
                    if (header === "Referer") {
                        return "https://staging--ffftemp.netlify.app/login?redirectPath=/make_trade";
                    }
                    return undefined;
                }),
            } as unknown as Request;

            expect(isNetlifyOrigin(mockReq)).toBe(true);
        });

        it("should prioritize Origin header over Referer header", () => {
            const mockReq = {
                get: jest.fn((header: string) => {
                    if (header === "Origin") {
                        return "https://staging.trades.akosua.xyz"; // Not a Netlify origin
                    }
                    if (header === "Referer") {
                        return "https://staging--ffftemp.netlify.app"; // Netlify origin
                    }
                    return undefined;
                }),
            } as unknown as Request;

            // Should return false because Origin takes priority and it's not a Netlify origin
            expect(isNetlifyOrigin(mockReq)).toBe(false);
        });
    });
});
