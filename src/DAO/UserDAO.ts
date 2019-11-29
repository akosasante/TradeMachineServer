import { NotFoundError } from "routing-controllers";
import { User } from "trade-machine-models/lib";
import { Connection, DeleteResult, FindManyOptions, getConnection, Repository } from "typeorm";
import util from "util";
import logger from "../bootstrap/logger";
import UserDO from "../models/user";

export default class UserDAO {
    private userDb: Repository<UserDO>;

    constructor(repo?: Repository<UserDO>) {
        this.userDb = repo || getConnection(process.env.NODE_ENV).getRepository("User");
    }

    public async getAllUsers(): Promise<User[]> {
        const options: FindManyOptions = { order: { id: "ASC" } };
        const dbUsers = await this.userDb.find(options);
        return dbUsers.map(user => user.toUserModel());
    }

    public async getAllUsersWithTeams(): Promise<User[]> {
        const options: FindManyOptions = { order: { id: "ASC" }, relations: ["team"]};
        const dbUsers = await this.userDb.find(options);
        return dbUsers.map(user => user.toUserModel());
    }

    public async getUserById(id: string): Promise<User> {
        const dbUser = await this.userDb.findOneOrFail(id);
        return dbUser.toUserModel();
    }

    public async findUser(query: Partial<UserDO>, failIfNotFound: boolean = true): Promise<User|undefined> {
        const findFn = failIfNotFound ? this.userDb.findOneOrFail : this.userDb.findOne;
        const dbUser = await findFn({where: query});
        return dbUser ? dbUser.toUserModel() : undefined;
    }
    
    public async findUsers(query: Partial<UserDO>): Promise<User[]> {
        const dbUsers = await this.userDb.find({where: query});
        return dbUsers.map(user => user.toUserModel());
    }

    public async createUsers(userObjs: Array<Partial<UserDO>>): Promise<User[]> {
        const dbUsers = await this.userDb.save(userObjs);
        return dbUsers.map(user => user.toUserModel());
    }
    
    public async updateUser(id: string, userObj: Partial<UserDO>): Promise<User> {
        const updateResult = await this.userDb.update({id}, userObj);
        return await this.getUserById(id);
    }
    //
    // public async deleteUser(id: number): Promise<DeleteResult> {
    //     await this.getUserById(id); // This should throw error if the id does not exist
    //     return await this.userDb.createQueryBuilder()
    //         .delete()
    //         .whereInIds(id)
    //         .returning("id")
    //         .execute();
    // }
    //
    // public async setPasswordExpires(id: number): Promise<void> {
    //     const passwordResetToken = uuidV4();
    //     const updateResult = await this.userDb.update(
    //         {id},
    //         {
    //             passwordResetExpiresOn: User.generateTimeToPasswordExpires(),
    //             passwordResetToken });
    //     logger.debug(util.inspect(updateResult));
    //     return;
    // }
}
