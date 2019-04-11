import { Authorized, Body, Delete, Get, JsonController,
    Param, Post, Put, QueryParam, QueryParams } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import User, { Role } from "../../models/user";
import { cleanupQuery } from "../ApiHelpers";

@JsonController("/users")
export default class UserController {
    private dao: UserDAO;

    constructor(DAO?: UserDAO) {
        // ^ injected in tests
        this.dao = DAO || new UserDAO();
    }

    @Get("/")
    public async getAll(@QueryParam("full") full?: boolean): Promise<User[]> {
        logger.debug(`get all users endpoint${full ? " with teams" : ""}`);
        const users = full ? await this.dao.getAllUsersWithTeams() : await this.dao.getAllUsers();
        logger.debug(`got ${users.length} users`);
        return (users || []).map(user => user.publicUser);
    }

    @Get("/:id([0-9]+)")
    public async getOne(@Param("id") id: string, @QueryParam("byUUID") byUUID?: boolean): Promise<User> {
        logger.debug(`get one user endpoint${byUUID ? " by UUID" : ""}`);
        const user = byUUID ? await this.dao.getUserByUUID(id) : await this.dao.getUserById(Number(id));
        logger.debug(`got user: ${user}`);
        return (user || {} as User).publicUser;
    }

    @Get("/search")
    public async findUser(@QueryParams() query: Partial<User>): Promise<User[]|User|undefined> {
        logger.debug(`searching for user with props: ${inspect(query)}`);
        const multiple = Object.keys(query).includes("multiple");
        if (multiple) {
            logger.debug("fetching all users with query");
            const users = await this.dao.findUsers(cleanupQuery(query as { [key: string]: string }), true);
            logger.debug(`got ${users.length} users`);
            return users.map(user => user.publicUser);
        } else {
            logger.debug("fetching one user with query");
            const user = await this.dao.findUser(cleanupQuery(query as { [key: string]: string }), true);
            return (user || {} as User).publicUser;
        }
    }

    @Authorized(Role.ADMIN)
    @Post("/")
    public async createUser(@Body() userObj: Partial<User>): Promise<User> {
        logger.debug("create user endpoint");
        // const { password, ...userRest } = userObj;
        // ^ Because we don't hash passwords on insert.
        // Not sure what I was thinking here? Why not allow passing password on create API-wise?
        // const user = await this.dao.createUser(userRest);
        const user = await this.dao.createUser(userObj);
        logger.debug(`created user: ${user}`);
        return user.publicUser;
    }

    @Authorized(Role.ADMIN)
    @Put("/:id")
    public async updateUser(@Param("id") id: number, @Body() userObj: Partial<User>): Promise<User> {
        logger.debug("update user endpoint");
        const user = await this.dao.updateUser(id, userObj);
        logger.debug(`updated user: ${user}`);
        return user.publicUser;
    }

    @Authorized(Role.ADMIN)
    @Delete("/:id")
    public async deleteUser(@Param("id") id: number) {
        logger.debug("delete user endpoint");
        const result = await this.dao.deleteUser(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        return await {deleteResult: !!result.raw[1], id};
    }
}
