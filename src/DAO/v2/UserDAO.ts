import { Prisma } from "@prisma/client";
import { exclude } from "./helpers";
import { ExtendedPrismaClient } from "../../bootstrap/prisma-db";

type User = Prisma.Result<ExtendedPrismaClient["user"], Record<string, unknown>, "findFirstOrThrow">;
export type PublicUser = Omit<User, "password">;

export default class UserDAO {
    private readonly userDb: ExtendedPrismaClient["user"];

    constructor(userDb: ExtendedPrismaClient["user"] | undefined) {
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

    public async getUserById(id: string): Promise<PublicUser> {
        const user = await this.userDb.findUniqueOrThrow({ where: { id } });
        return UserDAO.publicUser(user);
    }

    public async findUserWithPasswordByEmail(email: string): Promise<User | null> {
        const user = await this.userDb.findUnique({
            where: { email },
            select: { id: true, email: true, password: true, role: true, status: true, lastLoggedIn: true },
        });
        if (user) {
            return user as User;
        } else {
            return null;
        }
    }

    public async createUsers(userObjs: Partial<User>[]): Promise<PublicUser[]> {
        await this.userDb.createMany({
            data: userObjs.map(user => ({
                ...user,
                email: user.email || "",
                espnMember: user.espnMember ?? undefined,
            })),
            skipDuplicates: true,
        });
        const users = await this.userDb.findMany({
            where: { email: { in: userObjs.map(user => user.email!) } },
        });
        return UserDAO.publicUsers(users);
    }

    public async updateUser(id: string, userObj: Partial<User>): Promise<PublicUser> {
        const updatedUser = await this.userDb.update({
            where: { id },
            data: userObj as unknown as Prisma.UserUpdateInput,
        });
        return UserDAO.publicUser(updatedUser);
    }
}
