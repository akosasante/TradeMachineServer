import { Request, Response } from "express";
import { ExtendedPrismaClient } from "../bootstrap/prisma-db";
import Users from "../DAO/v2/UserDAO";
export interface Context {
    req: Request;
    res: Response;
    session?: {
        user?: string;
    };
    prisma: ExtendedPrismaClient;
    userDao: Users;
}
export declare const router: any;
export declare const publicProcedure: any;
export declare const protectedProcedure: any;
//# sourceMappingURL=trpc.d.ts.map