import {
    Authorized, Body, Delete, Get, JsonController, NotFoundError,
    Param, Post, Put, QueryParam, QueryParams
} from "routing-controllers";
// import User, { Role } from "../../models/user";
import { User } from "@akosasante/trade-machine-models";
import { getConnection } from "typeorm";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import { cleanupQuery } from "../ApiHelpers";
import UserDO, {Role} from "../../models/user";

@JsonController("/users")
export default class UserController {
    private dao: UserDAO;

    constructor(DAO?: UserDAO) {
        this.dao = DAO || new UserDAO();
    }

    @Get("/")
    public async getAll(@QueryParam("full") full?: boolean): Promise<User[]> {
        logger.debug(`get all users endpoint${full ? " with teams" : ""}`);
        const users = full ? await this.dao.getAllUsersWithTeams() : await this.dao.getAllUsers();
        logger.debug(`got ${users.length} users`);
        return users;
    }

    @Get("/:id([0-9a-fA-F]{8}\\\\-[0-9a-fA-F]{4}\\\\-[0-9a-fA-F]{4}\\\\-[0-9a-fA-F]{4}\\\\-[0-9a-fA-F]{12})")
    public async getById(@Param("id") id: string): Promise<User> {
        logger.debug("get one user by id endpoint");
        const user = await this.dao.getUserById(id);
        logger.debug(`got user: ${user}`);
        return user;
    }
    
    @Get("/search")
    public async findUser(@QueryParam("query") query: Partial<UserDO>,
                          @QueryParam("multiple") multiple: boolean): Promise<User[]|User|undefined> {
        logger.debug(`searching for user with props: ${inspect(query)}, multiple=${multiple}`);
        if (multiple) {
            logger.debug("fetching all users with query");
            const users = await this.dao.findUsers(cleanupQuery(query as { [key: string]: string }));
            if (users.length) {
                logger.debug(`got ${users.length} users`);
                return users;
            } else {
                throw new NotFoundError("No users found matching that query");
            }
        } else {
            logger.debug("fetching one user with query");
            const user = await this.dao.findUser(cleanupQuery(query as { [key: string]: string }), true);
            logger.debug(`got user: ${user}`);
            return user;
        }
    }

    @Authorized(Role.ADMIN)
    @Post("/")
    public async createUsers(@Body() userObjs: Array<Partial<UserDO>>): Promise<User[]> {
        logger.debug("create user endpoint");
        const users = await this.dao.createUsers(userObjs);
        logger.debug(`created user: ${inspect(users)}`);
        return users;
    }

    @Authorized(Role.ADMIN)
    @Put("/:id")
    public async updateUser(@Param("id") id: string, @Body() userObj: Partial<UserDO>): Promise<User> {
        logger.debug("update user endpoint");
        const user = await this.dao.updateUser(id, userObj);
        logger.debug(`updated user: ${user}`);
        return user;
    }

    // @Authorized(Role.ADMIN)
    // @Delete("/:id")
    // public async deleteUser(@Param("id") id: number) {
    //     logger.debug("delete user endpoint");
    //     const result = await this.dao.deleteUser(id);
    //     logger.debug(`delete successful: ${inspect(result)}`);
    //     return await {deleteCount: result.affected, id: result.raw[0].id};
    // }
}
