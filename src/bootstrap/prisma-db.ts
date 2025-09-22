import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { Request } from "express";
import { getAppSettings } from "./express";

const extendPrismaClient = (basePrisma: PrismaClient) =>
    basePrisma.$extends({
        result: {
            user: {
                isAdmin: {
                    needs: { role: true },
                    compute(user: { role: UserRole }) {
                        return () => user.role === UserRole.ADMIN;
                    },
                },
            },
        },
    });

export type ExtendedPrismaClient = ReturnType<typeof extendPrismaClient>;
export default function initializeDb(log = false): ExtendedPrismaClient {
    const options: Prisma.PrismaClientOptions = {};
    if (log) {
        options.log = ["query", "info", "warn", "error"];
        options.errorFormat = "pretty";
    }
    const basePrisma = new PrismaClient(options);
    return extendPrismaClient(basePrisma);
}

export const getPrismaClientFromRequest = (request?: Request): ExtendedPrismaClient | undefined => {
    const expressSettings = getAppSettings(request);
    if (!expressSettings) {
        return undefined;
    }
    return expressSettings?.prisma;
};
