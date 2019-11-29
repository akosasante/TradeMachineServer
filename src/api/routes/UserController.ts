import { Authorized, Body, Delete, Get, JsonController,
    Param, Post, Put, QueryParam, QueryParams } from "routing-controllers";
// import User, { Role } from "../../models/user";
import { User } from "trade-machine-models/lib";
import { getConnection } from "typeorm";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import { cleanupQuery } from "../ApiHelpers";

@JsonController("/users")
export default class UserController {
    private dao: UserDAO;

    constructor(DAO?: UserDAO) {
        this.dao = DAO || new UserDAO();
    }

    @Get("/")
    public async getAll(@QueryParam("full") full?: boolean): Promise<User[]> {
        logger.debug(`get all users endpoint${full ? " with teams" : ""}`);
        // const users = full ? await this.dao.getAllUsersWithTeams() : await this.dao.getAllUsers();
        const users = await this.dao.getAllUsers();
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

    // @Get("/:uuid([0-9a-fA-F]{8}\\-[0-9a-fA-F]{4}\\-[0-9a-fA-F]{4}\\-[0-9a-fA-F]{4}\\-[0-9a-fA-F]{12})")
    // public async getByUUID(@Param("uuid") id: string, @QueryParam("byUUID") byUUID?: boolean): Promise<User> {
    //     logger.debug(`get one user endpoint${byUUID ? " by UUID" : ""}`);
    //     // const user = byUUID ? await this.dao.getUserByUUID(id) : await this.dao.getUserById(Number(id));
    //     const user = await this.dao.getUserById(Number(id));
    //     logger.debug(`got user: ${user}`);
    //     return (user || {} as User).publicUser;
    // }

    // @Get("/search")
    // public async findUser(@QueryParams() query: Partial<User>): Promise<User[]|User|undefined> {
    //     logger.debug(`searching for user with props: ${inspect(query)}`);
    //     const multiple = Object.keys(query).includes("multiple");
    //     if (multiple) {
    //         logger.debug("fetching all users with query");
    //         const users = await this.dao.findUsers(cleanupQuery(query as { [key: string]: string }), true);
    //         logger.debug(`got ${users.length} users`);
    //         return users.map(user => user.publicUser);
    //     } else {
    //         logger.debug("fetching one user with query");
    //         const user = await this.dao.findUser(cleanupQuery(query as { [key: string]: string }), true);
    //         logger.debug(`${(user || {} as User).publicUser}`);
    //         return (user || {} as User).publicUser;
    //     }
    // }
    //
    // @Authorized(Role.ADMIN)
    // @Post("/")
    // public async createUser(@Body() userObj: Partial<User>): Promise<User> {
    //     logger.debug("create user endpoint");
    //     // const { password, ...userRest } = userObj;
    //     // ^ Because we don't hash passwords on insert.
    //     // Not sure what I was thinking here? Why not allow passing password on create API-wise?
    //     // const user = await this.dao.createUser(userRest);
    //     const user = await this.dao.createUser(userObj);
    //     logger.debug(`created user: ${user}`);
    //     return user.publicUser;
    // }
    //
    // @Authorized(Role.ADMIN)
    // @Put("/:id")
    // public async updateUser(@Param("id") id: number, @Body() userObj: Partial<User>): Promise<User> {
    //     logger.debug("update user endpoint");
    //     const user = await this.dao.updateUser(id, userObj);
    //     logger.debug(`updated user: ${user}`);
    //     return user.publicUser;
    // }
    //
    // @Authorized(Role.ADMIN)
    // @Delete("/:id")
    // public async deleteUser(@Param("id") id: number) {
    //     logger.debug("delete user endpoint");
    //     const result = await this.dao.deleteUser(id);
    //     logger.debug(`delete successful: ${inspect(result)}`);
    //     return await {deleteCount: result.affected, id: result.raw[0].id};
    // }
}
