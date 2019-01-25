// import {Repository} from "typeorm";
import User, { Role } from "../models/user";

export default class UserDAO {
    // constructor(private userDb: Repository<User>) {}

    public async getUserById(id: number): Promise<User> {
        if (id === 100) {
            return new User({id: 100, roles: [Role.ADMIN]});
        }
        return new User({id: 1});
        // return await this.userDb.findOne(id);
    }

    public async findUser(query: Partial<User>): Promise<User> {
        if (query && query.email && query.email.includes("admin")) {
            return new User({...query, id: 100});
        }
        return new User({id: 2, ...query});
    }

    public async createUser(userObj: Partial<User>): Promise<User> {
        return new User(userObj);
    }
}
