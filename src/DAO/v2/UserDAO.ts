import { PrismaClient, User } from "@prisma/client";
import exclude from "./helpers";

export type PublicUser = Omit<User, "password">;

export default class UserDAO {
    constructor(private readonly userDb: PrismaClient['user']) {}

    // TODO: Possibly these static functions would go into their own class at some point; or maybe we keep it flat like this
    static publicUser(user: User) {
        return exclude(user, "password");
    }

    static publicUsers(users: User[]) {
        return users.map(user => UserDAO.publicUser(user))
    }

    public async getAllUsers(): Promise<PublicUser[]> {
        const users = await this.userDb.findMany({orderBy: { id: 'asc' }});
        return UserDAO.publicUsers(users);
    }
}