import { DeleteResult, FindManyOptions, FindOneOptions, getConnection, In, InsertResult, Repository } from "typeorm";
import User from "../models/user";
import { v4 as uuid } from "uuid";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

interface UserDeleteResult extends DeleteResult {
    raw: User[];
    affected?: number | null;
}

export default class UserDAO {
    private readonly userDb: Repository<User>;

    constructor(repo?: Repository<User>) {
        this.userDb = repo || getConnection(process.env.ORM_CONFIG).getRepository("User");
    }

    public async getAllUsers(): Promise<User[]> {
        const options: FindManyOptions = { order: { id: "ASC" } };
        return await this.userDb.find(options);
    }

    public async getAllUsersWithTeams(): Promise<User[]> {
        const options: FindManyOptions = { order: { id: "ASC" }, relations: ["team"] };
        return await this.userDb.find(options);
    }

    public async getUserById(id: string, withUser = false): Promise<User> {
        const options = withUser ? { relations: ["team"] } : {};
        return await this.userDb.findOneOrFail({ where: { id }, ...options });
    }

    public async findUser(query: Partial<User>, failIfNotFound = true): Promise<User | null> {
        const findFn = failIfNotFound
            ? this.userDb.findOneOrFail.bind(this.userDb)
            : this.userDb.findOne.bind(this.userDb);
        return findFn({ where: { ...query } } as FindOneOptions<User>);
    }

    public async findUserWithPasswordByEmail(email: string): Promise<User | null> {
        return await this.userDb
            .createQueryBuilder("user")
            .select("user.id")
            .addSelect("user.password")
            .addSelect("user.email")
            .where("user.email ILIKE :email", { email })
            .getOne();
    }

    public async findUsers(query: Partial<User>): Promise<User[]> {
        return await this.userDb.find({ where: { ...query } } as FindManyOptions<User>);
    }

    public async createUsers(userObjs: Partial<User>[]): Promise<User[]> {
        const userEntities = userObjs.map(userObj => this.userDb.create(userObj));
        return await this.userDb.save(userEntities);
    }

    public async updateUser(id: string, userObj: Partial<User>): Promise<User> {
        await this.userDb.update({ id }, userObj as QueryDeepPartialEntity<User>);
        return await this.getUserById(id);
    }

    public async deleteUser(id: string): Promise<UserDeleteResult> {
        await this.getUserById(id); // This should throw error if the id does not exist
        return await this.userDb.createQueryBuilder().delete().whereInIds(id).returning("id").execute();
    }

    public async setPasswordExpires(id: string): Promise<User> {
        await this.getUserById(id); // This should throw error if the id does not exist
        await this.userDb.update(
            { id },
            {
                passwordResetExpiresOn: User.generateTimeToPasswordExpires(),
                passwordResetToken: uuid(),
            }
        );
        return await this.getUserById(id);
    }
}
