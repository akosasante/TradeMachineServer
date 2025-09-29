import { Request, Response } from "express";
import { Context } from "./trpc";
/**
 * Creates the tRPC context from Express request/response
 * Integrates with existing Express middleware (sessions, Prisma, etc.)
 */
export declare const createContext: ({ req, res }: {
    req: Request;
    res: Response;
}) => Context;
//# sourceMappingURL=context.d.ts.map