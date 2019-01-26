import { getConnection, Repository } from "typeorm";
import User from "../models/user";

export default class UserDAO {
    private userDb: Repository<User>;
    // constructor(private userDb: Repository<User>) {}
    constructor() {
        this.userDb = getConnection(process.env.NODE_ENV).getRepository("User");
    }

    public async getAllUsers(): Promise<User[]> {
        return await this.userDb.find();
    }

    public async getUserById(id: number): Promise<User> {
        return await this.userDb.findOneOrFail(id);
    }

    public async findUser(query: Partial<User>): Promise<User> {
        return await this.userDb.findOneOrFail({ where: query });
    }

    public async createUser(userObj: Partial<User>): Promise<User> {
        // TODO: Perhaps some custom validation that the db can't be responsible for?
        // Currently doesn't seem to be necessary
        const user = new User(userObj);
        return await this.userDb.save(user);
    }
}
