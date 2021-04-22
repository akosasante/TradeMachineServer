import User, { Role } from "../../models/user";
import {
    Authorized,
    Body,
    Delete,
    Get,
    JsonController,
    NotFoundError,
    Param,
    Post,
    Put,
    QueryParam,
} from "routing-controllers";
import { inspect } from "util";
import logger from "../../bootstrap/logger";
import UserDAO from "../../DAO/UserDAO";
import { cleanupQuery, UUID_PATTERN } from "../helpers/ApiHelpers";
import { URLSearchParams } from "url";
import { rollbar } from "../../bootstrap/rollbar";

@JsonController("/users")
export default class UserController {
    private dao: UserDAO;

    constructor(dao?: UserDAO) {
        this.dao = dao || new UserDAO();
    }

    @Get("/")
    public async getAll(@QueryParam("full") full?: boolean): Promise<User[]> {
        logger.debug(`get all users endpoint${full ? " with teams" : ""}`);
        rollbar.info("getAllUsers", { full });
        const users = full ? await this.dao.getAllUsersWithTeams() : await this.dao.getAllUsers();
        logger.debug(`got ${users.length} users`);
        return users;
    }

    @Get(UUID_PATTERN)
    public async getById(@Param("id") id: string): Promise<User> {
        logger.debug("get one user by id endpoint");
        rollbar.info("getUserById", { id });
        const user = await this.dao.getUserById(id);
        logger.debug(`got user: ${user}`);
        return user;
    }

    @Get("/search")
    public async findUser(
        @QueryParam("query") query: string,
        @QueryParam("multiple") multiple?: boolean
    ): Promise<User[] | User> {
        logger.debug(`searching for user with props: ${query}, multiple=${multiple}`);
        rollbar.info("findUser", { query, multiple });
        const queryObj = Array.from(new URLSearchParams(query)).reduce((acc, [key, value]) => {
            (acc as { [k: string]: string })[key] = value;
            return acc;
        }, {} as Partial<User>);
        if (multiple) {
            logger.debug(`fetching all users with query: ${inspect(queryObj)}`);

            const users = await this.dao.findUsers(cleanupQuery(queryObj as { [key: string]: string }));
            if (users.length) {
                logger.debug(`got ${users.length} users`);
                return users;
            } else {
                throw new NotFoundError("No users found matching that query");
            }
        } else {
            logger.debug(`fetching one user with query: ${inspect(queryObj)}`);
            const user = await this.dao.findUser(cleanupQuery(queryObj as { [key: string]: string }), true);
            logger.debug(`got user: ${user}`);
            return user!;
        }
    }

    /* Only league admins can directly edit/delete/create users */

    @Authorized(Role.ADMIN)
    @Post("/")
    public async createUsers(@Body() userObjs: Partial<User>[]): Promise<User[]> {
        logger.debug(`create user endpoint: ${inspect(userObjs)}`);
        rollbar.info("createUsers", { userObjs });
        const users = await this.dao.createUsers(userObjs);
        logger.debug(`created users: ${users.length}`);
        logger.debug(`created users: ${users[0]}`);
        logger.debug(`created users: ${inspect(users)}`);
        return users;
    }

    @Authorized(Role.ADMIN)
    @Put(UUID_PATTERN)
    public async updateUser(@Param("id") id: string, @Body() userObj: Partial<User>): Promise<User> {
        logger.debug("update user endpoint");
        rollbar.info("updateUser", { id, userObj });
        const user = await this.dao.updateUser(id, userObj);
        logger.debug(`updated user: ${user}`);
        return user;
    }

    @Authorized(Role.ADMIN)
    @Delete(UUID_PATTERN)
    public async deleteUser(@Param("id") id: string): Promise<{ deleteCount: number | null | undefined; id: any }> {
        logger.debug("delete user endpoint");
        rollbar.info("deleteUser", { id });
        const result = await this.dao.deleteUser(id);
        logger.debug(`delete successful: ${inspect(result)}`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
        return { deleteCount: result.affected, id: result.raw[0].id };
    }
}
