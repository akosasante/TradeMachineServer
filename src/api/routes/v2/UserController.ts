import { Request } from "express";
import {Get, JsonController, Req } from "routing-controllers";
import logger from "../../../bootstrap/logger";
import Users, {PublicUser} from "../../../DAO/v2/UserDAO";

@JsonController("/v2/users")
export default class V2UserController {
    private daoInstance: Users | undefined

    private dao(req: Request | undefined) {
        if (this.daoInstance) {
            return this.daoInstance
        } else if (!req) {
            throw new Error("HTTP request object required!")
        } else {
            this.daoInstance = new Users(req.app.settings.prisma.user);
            return this.daoInstance
        }
    }

    constructor(daoInstance?: Users) {
        this.daoInstance = daoInstance;
    }

    @Get("/")
    public async getAll(@Req() req?: Request): Promise<PublicUser[]> {
        logger.debug(`V2: get all users endpoint`);
        const users = await this.dao(req).getAllUsers();
        logger.debug(`got ${users.length} users`);
        return users;
    }
}