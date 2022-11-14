import { Request } from "express";
import { Get, JsonController, Req } from "routing-controllers";
import logger from "../../../bootstrap/logger";
import Users, { PublicUser } from "../../../DAO/v2/UserDAO";
import { PrismaClient } from "@prisma/client";
import { ExpressAppSettings } from "../../../bootstrap/express";

@JsonController("/v2/users")
export default class V2UserController {
    private daoInstance: Users | undefined;

    private dao(req: Request | undefined) {
        if (this.daoInstance) {
            return this.daoInstance;
        } else if (!req) {
            throw new Error("HTTP request object required!");
        } else {
            const appSettings: ExpressAppSettings = req.app.settings as ExpressAppSettings;
            this.daoInstance = new Users(appSettings?.prisma?.user as PrismaClient["user"]);
            return this.daoInstance;
        }
    }

    constructor(daoInstance?: Users) {
        this.daoInstance = daoInstance;
    }

    @Get("/")
    public async getAll(@Req() req?: Request): Promise<PublicUser[]> {
        logger.debug("V2: get all users endpoint");
        const users = await this.dao(req).getAllUsers();
        logger.debug(`got ${users.length} users`);
        return users;
    }
}
