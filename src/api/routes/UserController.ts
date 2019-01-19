import { Body, Delete, Get, JsonController, Param, Post, Put } from "routing-controllers";

@JsonController("/users")
export default class UserController {
    @Get("/")
    public async getAll() {
        return await "getting all users";
    //    throw new Error("something went wrong!")
    }

    @Get("/:id")
    public async getOne(@Param("id") id: any) {
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
    public async deleteUser(@Param("id") id: any) {
        return await `deleting user with id ${id}`;
    }
}
