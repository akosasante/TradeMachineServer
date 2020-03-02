import { User } from "@akosasante/trade-machine-models";
import { DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import UserDO from "../models/user";

export default class UserDAO {
    private userDb: Repository<UserDO>;

    constructor(repo?: Repository<UserDO>) {
        this.userDb = repo || getConnection(process.env.NODE_ENV).getRepository("user");
    }

    public async getAllUsers(): Promise<UserDO[]> {
        const options: FindManyOptions = { order: { id: "ASC" } };
        return await this.userDb.find(options);
    }

    public async getAllUsersWithTeams(): Promise<UserDO[]> {
        const options: FindManyOptions = { order: { id: "ASC" }, relations: ["team"]};
        return await this.userDb.find(options);
    }

    public async getUserById(id: string): Promise<UserDO> {
        return await this.userDb.findOneOrFail(id);
    }

    public async findUser(query: Partial<UserDO>, failIfNotFound: boolean = true): Promise<UserDO|undefined> {
        const findFn = failIfNotFound ? this.userDb.findOneOrFail : this.userDb.findOne;
        return await findFn({where: query});
    }

    public async findUsers(query: Partial<UserDO>): Promise<UserDO[]> {
        return await this.userDb.find({where: query});
    }

    public async createUsers(userObjs: Partial<UserDO>[]): Promise<UserDO[]> {
        return await this.userDb.save(userObjs);
    }

    public async updateUser(id: string, userObj: Partial<UserDO>): Promise<UserDO> {
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
