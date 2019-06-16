import { NotFoundError } from "routing-controllers";
import { Connection, DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import util from "util";
import uuidV4 from "uuid/v4";
import logger from "../bootstrap/logger";
import User from "../models/user";

export default class UserDAO {
    public connection: Connection;
    private userDb: Repository<User>;
    // constructor(private userDb: Repository<User>) {}
    constructor() {
        this.connection = getConnection(process.env.NODE_ENV);
        this.userDb = this.connection.getRepository("User");
        // const connection = getConnection(process.env.NODE_ENV);
        // logger.debug(connection);
        // this.userDb = connection.getRepository("User");
        // logger.debug(this.userDb);
    }

    public async getAllUsers(): Promise<User[]> {
        const options: FindManyOptions = { order: { id: "ASC" } };
        const dbUsers = await this.userDb.find(options);
        return dbUsers.map(user => new User(user));
    }

    public async getAllUsersWithTeams(): Promise<User[]> {
        const options: FindManyOptions = { order: { id: "ASC" }, relations: ["team"]};
        const dbUsers = await this.userDb.find(options);
        return dbUsers.map(user => new User(user));
    }

    public async getUserById(id: number): Promise<User> {
        if (!id) {
            throw new NotFoundError("Id is required");
        }
        const dbUser = await this.userDb.findOneOrFail(id);
        return new User(dbUser);
    }

    public async getUserByUUID(uuid: string): Promise<User|undefined> {
        if (!uuid) {
            throw new NotFoundError("UUID is required");
        }
        return await this.findUser({userIdToken: uuid});
    }

    public async findUser(query: Partial<User>, failIfNotFound: boolean = true): Promise<User|undefined> {
        if (failIfNotFound) {
            const dbUser = await this.userDb.findOneOrFail({where: query});
            return new User(dbUser);
        } else {
            const dbUser = await this.userDb.findOne({where: query});
            return dbUser ? new User(dbUser) : undefined;
        }
    }

    public async findUsers(query: Partial<User>, failIfNotFound: boolean = true): Promise<User[]> {
        const dbUsers = await this.userDb.find({where: query});
        if (dbUsers.length) {
            return dbUsers.map(user => new User(user));
        } else if (failIfNotFound) {
            throw new NotFoundError("No users found for that query");
        } else {
            return [];
        }
    }

    public async createUser(userObj: Partial<User>, skipHash: boolean = false): Promise<User> {
        // TODO: Perhaps some custom validation that the db can't be responsible for?
        logger.debug("creating");
        // Currently doesn't seem to be necessary
        if (userObj.password && !skipHash) {
            // Doing this here because I couldn't get beforeinsert to work
            userObj.password = await User.generateHashedPassword(userObj.password);
        }
        const dbUser = await this.userDb.save(userObj);
        logger.debug("done");
        return new User(dbUser);
    }

    public async updateUser(id: number, userObj: Partial<User>): Promise<User> {
        const updateResult = await this.userDb.update({id}, userObj);
        logger.debug(util.inspect(updateResult));
        return await this.getUserById(id);
    }

    public async deleteUser(id: number): Promise<DeleteResult> {
        await this.getUserById(id); // This should throw error if the id does not exist
        return await this.userDb.delete(id);
    }

    public async setPasswordExpires(id: number): Promise<void> {
        const passwordResetToken = uuidV4();
        const updateResult = await this.userDb.update(
            {id},
            {
                passwordResetExpiresOn: User.generateTimeToPasswordExpires(),
                passwordResetToken });
        logger.debug(util.inspect(updateResult));
        return;
    }
}
