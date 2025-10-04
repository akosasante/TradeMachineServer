import { Request, Response } from "express";
import { Context } from "./trpcHelpers";
import { getPrismaClientFromRequest } from "../../../bootstrap/prisma-db";
import Users from "../../../DAO/v2/UserDAO";

/**
 * Creates the tRPC context from Express request/response
 * Integrates with existing Express middleware (sessions, Prisma, etc.)
 */
export const createContext = ({ req, res }: { req: Request; res: Response }): Context => {
    // Get Prisma client from existing middleware setup
    const prisma = getPrismaClientFromRequest(req);

    if (!prisma) {
        throw new Error("Prisma client not available - ensure Prisma middleware is properly configured");
    }

    // Create v2 DAO with Prisma client
    const userDao = new Users(prisma.user);

    return {
        req,
        res,
        session: req.session, // Your existing session middleware
        prisma,
        userDao,
    };
};
