import { Authorized, Body, CurrentUser, Delete, Get, JsonController, Param, Post, Put } from "routing-controllers";
import util from "util";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/user";
import User, { Role } from "../../models/user";

@JsonController("/users")
export default class UserController {
    private dao: UserDAO;

    constructor() {
        this.dao = new UserDAO();
    }

    @Authorized(Role.ADMIN)
    @Get("/")
    public async getAll(): Promise<User[]> {
        logger.debug("get all users endpoint");
        const users = await this.dao.getAllUsers();
        logger.debug(`got ${users.length} users`);
        return users.map(user => user.publicUser);
    }

    @Get("/:id")
    public async getOne(@Param("id") id: number, @CurrentUser() currentUser?: User): Promise<User> {
        logger.debug("get one user endpoint");
        const user = await this.dao.getUserById(id);
        logger.debug(`got user: ${user}`);
        return user.publicUser;
    }

    @Post("/")
    public async createUser(@Body() userObj: Partial<User>): Promise<User> {
        logger.debug("create user endpoint");
        const { password, ...userRest } = userObj;
        const user = await this.dao.createUser(userRest);
        logger.debug(`created user: ${user}`);
        return user.publicUser;
    }

    @Put("/:id")
    public async updateUser(@Param("id") id: number, @Body() userObj: any): Promise<User> {
        logger.debug("update user endpoint");
        const user = await this.dao.updateUser(id, userObj);
        logger.debug(`updated user: ${user}`);
        return user.publicUser;
    }

    @Delete("/:id")
    public async deleteUser(@CurrentUser({required: true}) user: User, @Param("id") id: number) {
        logger.debug("delete user endpoint");
        const result = await this.dao.deleteUser(id);
        logger.debug(`delete successful: ${util.inspect(result)}`);
        return await {deleteResult: !!result.raw[1], id};
    }
}
