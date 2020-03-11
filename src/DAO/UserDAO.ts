import { DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import User from "../models/user";

export default class UserDAO {
    private userDb: Repository<User>;

    constructor(repo?: Repository<User>) {
        this.userDb = repo || getConnection(process.env.NODE_ENV).getRepository("User");
    }

    public async getAllUsers(): Promise<User[]> {
        const options: FindManyOptions = { order: { id: "ASC" } };
        return await this.userDb.find(options);
    }

    public async getAllUsersWithTeams(): Promise<User[]> {
        const options: FindManyOptions = { order: { id: "ASC" }, relations: ["team"]};
        return await this.userDb.find(options);
    }

    public async getUserById(id: string): Promise<User> {
        return await this.userDb.findOneOrFail(id);
    }

    public async findUser(query: Partial<User>, failIfNotFound: boolean = true): Promise<User|undefined> {
        const findFn = failIfNotFound ? this.userDb.findOneOrFail.bind(this.userDb) : this.userDb.findOne.bind(this.userDb);
        return await findFn({where: query});
    }

    public async findUsers(query: Partial<User>): Promise<User[]> {
        return await this.userDb.find({where: query});
    }

    public async createUsers(userObjs: Partial<User>[]): Promise<User[]> {
        return await this.userDb.save(userObjs);
    }

    public async updateUser(id: string, userObj: Partial<User>): Promise<User> {
        await this.userDb.update({id}, userObj);
        return await this.getUserById(id);
    }

    public async deleteUser(id: string): Promise<DeleteResult> {
        await this.getUserById(id); // This should throw error if the id does not exist
        return await this.userDb.createQueryBuilder()
            .delete()
            .whereInIds(id)
            .returning("id")
            .execute();
    }
}
