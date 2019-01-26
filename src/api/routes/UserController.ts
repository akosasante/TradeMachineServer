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
    public async getAll() {
        logger.debug("geta ll users endpoint");
        const users = await this.dao.getAllUsers();
        logger.debug(`got ${users.length} users`);
        return users.map(user => user.publicUser);
    }

    @Get("/:id")
    public async getOne(@Param("id") id: number, @CurrentUser() currentUser?: User) {
        logger.debug("get one user endpoint");
        const user = await this.dao.getUserById(id);
        logger.debug(`got user: ${user}`);
        return user.publicUser;
    }

    @Post("/")
    public async createUser(@Body() userObj: Partial<User>) {
        logger.debug("create user endpoint");
        const user = await this.dao.createUser(userObj);
        logger.debug(`created user: ${user}`);
        return user.publicUser;
    }

    @Put("/:id")
    public async updateUser(@Param("id") id: any, @Body() user: any) {
        return await `updating user with id ${id}, looks like: ${user}`;
    }

    @Delete("/:id")
    public async deleteUser(@CurrentUser({required: true}) user: User, @Param("id") id: any) {
        logger.debug(`user delete available: ${util.inspect(user)}`);
        return await `deleting user with id ${id}`;
    }
}
