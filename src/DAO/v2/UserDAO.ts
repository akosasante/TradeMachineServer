import { PrismaClient, User } from "@prisma/client";
import { exclude } from "./helpers";

export type PublicUser = Omit<User, "password">;

export default class UserDAO {
    private readonly userDb: PrismaClient["user"];

    constructor(userDb: PrismaClient["user"] | undefined) {
        if (!userDb) {
            throw new Error("UserDAO must be initialized with a PrismaClient model instance!");
        }
        this.userDb = userDb;
    }

    // TODO: Possibly these static functions would go into their own class at some point; or maybe we keep it flat like this
    static publicUser(user: User): Omit<User, "password"> {
        return exclude(user, "password");
    }

    static publicUsers(users: User[]): Omit<User, "password">[] {
        return users.map(user => UserDAO.publicUser(user));
    }

    public async getAllUsers(): Promise<PublicUser[]> {
        const users = await this.userDb.findMany({ orderBy: { id: "asc" } });
        return UserDAO.publicUsers(users);
    }
}
