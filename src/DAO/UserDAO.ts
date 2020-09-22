import { DeleteResult, FindManyOptions, getConnection, In, InsertResult, Repository } from "typeorm";
import User from "../models/user";
import { v4 as uuid } from "uuid";

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

    public async getUserById(id: string, withUser = false): Promise<User> {
        const options = withUser ? {relations: ["team"]} : {};
        return await this.userDb.findOneOrFail(id, options);
    }

    public async findUser(query: Partial<User>, failIfNotFound: boolean = true): Promise<User|undefined> {
        const findFn = failIfNotFound ? this.userDb.findOneOrFail.bind(this.userDb) : this.userDb.findOne.bind(this.userDb);
        return await findFn(query);
    }

    public async findUserWithPassword(query: Partial<User>): Promise<User|undefined> {
        return await this.userDb
            .createQueryBuilder("user")
            .select("user.id")
            .addSelect("user.password")
            .addSelect("user.email")
            .where(query)
            .getOne();
    }

    public async findUsers(query: Partial<User>): Promise<User[]> {
        return await this.userDb.find({where: query});
    }

    public async createUsers(userObjs: Partial<User>[]): Promise<User[]> {
        const result: InsertResult = await this.userDb.insert(userObjs);
        return await this.userDb.find({id: In(result.identifiers.map(({id}) => id))});
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

    public async setPasswordExpires(id: string): Promise<User> {
        await this.getUserById(id); // This should throw error if the id does not exist
        await this.userDb.update(
            {id},
            {
                passwordResetExpiresOn: User.generateTimeToPasswordExpires(),
                passwordResetToken: uuid() });
        return await this.getUserById(id);
    }
}
