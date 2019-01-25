import { compare, hash } from "bcryptjs";

export enum Role {
    ADMIN = "Admin",
    OWNER = "Owner",
}

export default class User {

    public static async generateHashedPassword(plainPassword: string): Promise<string> {
        return hash(plainPassword, 24)
            .then(pass => pass)
            .catch(err => err);
    }

    public readonly id?: number;
    public name?: string;
    public email?: string;
    public password?: string;
    public username?: string;
    public roles: Role[] = [Role.OWNER];
    public dateCreated?: Date;
    public dateModified?: Date;

    constructor(userObj: Partial<User>) {
        Object.assign(this, userObj);
    }

    public async isPasswordMatching(password: string): Promise<boolean> {
        return compare(this.password || "", password)
            .then(pass => pass)
            .catch(err => err);
    }

    public toString(): string {
        return `User#${this.id}: ${this.name || this.username || this.email}`;
    }
}
