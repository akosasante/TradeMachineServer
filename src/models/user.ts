import { compare, hash } from "bcryptjs";
import {
    BeforeInsert,
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from "typeorm";
import logger from "../bootstrap/logger";

export enum Role {
    ADMIN = "Admin",
    OWNER = "Owner",
}

@Entity()
@Unique(["email"])
export default class User {
    public get publicUser(): Pick<this, Exclude<keyof this, "password">> {
        const { password, ...user } = this;
        return user;
    }

    public static async generateHashedPassword(plainPassword: string): Promise<string> {
        logger.debug("hashing password");
        return hash(plainPassword, 16)
            .then(pass => pass)
            .catch(err => err);
    }

    public static defaultPassword() {
        return "trade_machine_new_user";
    }

    @PrimaryGeneratedColumn()
    public readonly id?: number;

    @Column()
    public email?: string;

    @Column()
    public password?: string;

    @Column({nullable: true})
    public name?: string;

    @Column({nullable: true})
    public username?: string;

    @CreateDateColumn()
    public dateCreated?: Date;

    @UpdateDateColumn()
    public dateModified?: Date;

    @Column({ type: "enum", enum: Role, array: true, default: [Role.OWNER]})
    public roles?: Role[];

    constructor(userObj: Partial<User> = {}) {
        Object.assign(this, userObj);
    }

    @BeforeInsert()
    public async setHashedPassword() {
        this.password = await User.generateHashedPassword(this.password || User.defaultPassword());
    }

    public async isPasswordMatching(password: string): Promise<boolean> {
        return compare(password, this.password || "")
            .then(pass => pass)
            .catch(err => err);
    }

    public toString(): string {
        return `User#${this.id}: ${this.name || this.username || this.email || ""}`;
    }

    public isAdmin(): boolean {
        return this.hasRole(Role.ADMIN);
    }

    public hasRole(role: Role): boolean {
        return (this.roles || []).includes(role);
    }
}
