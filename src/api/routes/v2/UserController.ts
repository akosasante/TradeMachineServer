import { Request } from "express";
import { Get, JsonController, Req } from "routing-controllers";
import logger from "../../../bootstrap/logger";
import Users, { PublicUser } from "../../../DAO/v2/UserDAO";
import { rollbar } from "../../../bootstrap/rollbar";
import { getPrismaClientFromRequest } from "../../../bootstrap/prisma-db";

@JsonController("/v2/users")
export default class V2UserController {
    private daoInstance: Users | undefined;

    private dao(req: Request | undefined) {
        if (this.daoInstance) {
            return this.daoInstance;
        } else if (!req) {
            throw new Error("HTTP request object required!");
        } else {
            const prisma = getPrismaClientFromRequest(req);
            if (!prisma) {
                throw new Error("Prisma client not found in express app settings!");
            }
            this.daoInstance = new Users(prisma.user);
            return this.daoInstance;
        }
    }

    constructor(daoInstance?: Users) {
        this.daoInstance = daoInstance;
    }

    @Get("/")
    public async getAll(@Req() req?: Request): Promise<PublicUser[]> {
        rollbar.info("getAllUsers", req);
        logger.debug("V2: get all users endpoint");

        const users = await this.dao(req).getAllUsers();

        logger.debug(`got ${users.length} users`);
        return users;
    }
}
