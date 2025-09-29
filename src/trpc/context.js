"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContext = void 0;
const prisma_db_1 = require("../bootstrap/prisma-db");
const UserDAO_1 = __importDefault(require("../DAO/v2/UserDAO"));
/**
 * Creates the tRPC context from Express request/response
 * Integrates with existing Express middleware (sessions, Prisma, etc.)
 */
const createContext = ({ req, res }) => {
    // Get Prisma client from existing middleware setup
    const prisma = (0, prisma_db_1.getPrismaClientFromRequest)(req);
    if (!prisma) {
        throw new Error("Prisma client not available - ensure Prisma middleware is properly configured");
    }
    // Create v2 DAO with Prisma client
    const userDao = new UserDAO_1.default(prisma.user);
    return {
        req,
        res,
        session: req.session,
        prisma,
        userDao,
    };
};
exports.createContext = createContext;
//# sourceMappingURL=context.js.map