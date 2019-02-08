import {Connection, DeleteResult, getConnection, Repository} from "typeorm";
import util from "util";
import logger from "../bootstrap/logger";
import User from "../models/user";

export default class UserDAO {
    private userDb: Repository<User>;
    public connection: Connection;
    // constructor(private userDb: Repository<User>) {}
    constructor() {
        this.connection = getConnection(process.env.NODE_ENV);
        console.log(util.inspect(this.connection));
        this.userDb = this.connection.getRepository("User");
        console.log(util.inspect(this.userDb));
        // const connection = getConnection(process.env.NODE_ENV);
        // logger.debug(connection);
        // this.userDb = connection.getRepository("User");
        // logger.debug(this.userDb);
    }

    public async getAllUsers(): Promise<User[]> {
        const dbUsers = await this.userDb.find();
        return dbUsers.map(user => new User(user));
    }

    public async getUserById(id: number): Promise<User> {
        const dbUser = await this.userDb.findOneOrFail(id);
        return new User(dbUser);
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

    public async createUser(userObj: Partial<User>): Promise<User> {
        // TODO: Perhaps some custom validation that the db can't be responsible for?
        // Currently doesn't seem to be necessary
        const dbUser = await this.userDb.save(userObj);
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
}
