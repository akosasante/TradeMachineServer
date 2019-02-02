import { DeleteResult, getConnection, Repository } from "typeorm";
import util from "util";
import logger from "../bootstrap/logger";
import User from "../models/user";

export default class UserDAO {
    private userDb: Repository<User>;
    // constructor(private userDb: Repository<User>) {}
    constructor() {
        this.userDb = getConnection(process.env.NODE_ENV).getRepository("User");
        // const connection = getConnection(process.env.NODE_ENV);
        // logger.debug(connection);
        // this.userDb = connection.getRepository("User");
        // logger.debug(this.userDb);
    }

    public async getAllUsers(): Promise<User[]> {
        return await this.userDb.find();
    }

    public async getUserById(id: number): Promise<User> {
        return await this.userDb.findOneOrFail(id);
    }

    public async findUser(query: Partial<User>, failIfNotFound: boolean = true): Promise<User|undefined> {
        if (failIfNotFound) {
            return await this.userDb.findOneOrFail({where: query});
        } else {
            return await this.userDb.findOne({where: query});
        }
    }

    public async createUser(userObj: Partial<User>): Promise<User> {
        // TODO: Perhaps some custom validation that the db can't be responsible for?
        // Currently doesn't seem to be necessary
        const user = new User(userObj);
        return await this.userDb.save(user);
    }

    public async updateUser(id: number, userObj: Partial<User>): Promise<User> {
        const updateResult = await this.userDb.update({id}, userObj);
        logger.debug(util.inspect(updateResult));
        return await this.getUserById(id);
    }

    public async deleteUser(id: number): Promise<DeleteResult> {
        await this.getUserById(id);
        return await this.userDb.delete(id);
    }
}
