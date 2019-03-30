import { Authorized, Body, Delete, Get, JsonController,
    Param, Post, Put, QueryParam } from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import User, { Role } from "../../models/user";

@JsonController("/users")
export default class UserController {
    private dao: UserDAO;

    constructor(DAO?: UserDAO) {
        // ^ injected in tests
        this.dao = DAO || new UserDAO();
    }

    @Get("/")
    public async getAll(): Promise<User[]> {
        logger.debug("get all users endpoint");
        const users = (await this.dao.getAllUsers()) || [];
        logger.debug(`got ${users.length} users`);
        return users.map(user => user.publicUser);
    }

    @Get("/:id")
    public async getOne(@Param("id") id: string, @QueryParam("byUUID") byUUID?: boolean): Promise<User> {
        logger.debug(`get one user endpoint ${byUUID ? " by UUID" : ""}`);
        const user = byUUID ? await this.dao.getUserByUUID(id) : await this.dao.getUserById(Number(id));
        logger.debug(`got user: ${user}`);
        return (user || {} as User).publicUser;
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
