import { Authorized, Body, CurrentUser, Delete, Get, JsonController, Param, Post, Put } from "routing-controllers";
import util from "util";
import logger from "../../bootstrap/logger";
import User, { Role } from "../../models/user";

@JsonController("/users")
export default class UserController {
    @Authorized(Role.ADMIN)
    @Get("/")
    public async getAll() {
        return await "getting all users";
    //    throw new Error("something went wrong!")
    }

    @Get("/:id")
    public async getOne(@Param("id") id: number, @CurrentUser() user?: User) {
        logger.debug(`user available: ${util.inspect(user)}`);
        return await `get user with id: ${id}`;
    }

    @Post("/")
    public async createUser(@Body() user: any) {
        return await `creating new user ${user}`;
    }

    @Put("/:id")
    public async updateUser(@Param("id") id: any, @Body() user: any) {
        return await `updating user with id ${id}, looks like: ${user}`;
    }

    @Delete("/:id")
    public async deleteUser(@CurrentUser({required: true}) user: User, @Param("id") id: any) {
        logger.debug(`user delte available: ${util.inspect(user)}`);
        return await `deleting user with id ${id}`;
    }
}
