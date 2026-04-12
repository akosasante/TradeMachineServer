import { Request, Response } from "express";
import { Context } from "./trpcHelpers";
import { getPrismaClientFromRequest } from "../../../../bootstrap/prisma-db";
import Users from "../../../../DAO/v2/UserDAO";
import Teams from "../../../../DAO/v2/TeamDAO";
import Players from "../../../../DAO/v2/PlayerDAO";
import DraftPicks from "../../../../DAO/v2/DraftPickDAO";
import ObanDAO from "../../../../DAO/v2/ObanDAO";
import SyncJobExecutionDAO from "../../../../DAO/v2/SyncJobExecutionDAO";

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

    const userDao = new Users(prisma.user);
    const teamDao = new Teams(prisma.team);
    const playerDao = new Players(prisma.player);
    const draftPickDao = new DraftPicks(prisma.draftPick);
    const obanDao = new ObanDAO(prisma.obanJob);
    const syncJobExecutionDao = new SyncJobExecutionDAO(prisma.syncJobExecution);

    return {
        req,
        res,
        session: req.session,
        prisma,
        userDao,
        teamDao,
        playerDao,
        draftPickDao,
        obanDao,
        syncJobExecutionDao,
    };
};
