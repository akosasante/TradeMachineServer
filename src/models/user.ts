import { compare, hash } from "bcryptjs";
import { isEqual } from "lodash";
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

    // public static defaultPassword() {
    //     return "trade_machine_new_user";
    // }

    public static isUser(userObj: any): userObj is User {
        return (userObj as User).email !== undefined;
    }

    @PrimaryGeneratedColumn()
    public readonly id?: number;

    @Column()
    public email?: string;

    @Column({nullable: true})
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

    // @BeforeInsert()
    // public async setHashedPassword() {
    //     this.password = await User.generateHashedPassword(this.password || User.defaultPassword());
    // }

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

    public parse(): Partial<User> {
        return Object.assign({}, this);
    }

    public equals(other: User, excludes: Excludes = {id: true, password: true}): boolean {
        const includes = Object.keys(excludes).filter((excludesKey: keyof Excludes) =>
            !excludes[excludesKey]) as Array<keyof User>;
        const props = ["email", "name", "username"].concat(includes) as Array<keyof User>;
        const objects = ["roles"] as Array<keyof User>;
        return propsEqual(props, this, other) && objectsEqual(objects, this, other);
    }
}

function objectsEqual<T>(props: Array<keyof T>, obj1: T, obj2: T): boolean {
    return props.reduce((bool: boolean, prop: keyof T) => {
        const res = bool && objectEqual(prop, obj1, obj2);
        if (!res) {
            throw Error("Not matching: " + prop);
        }
        return res;
    }, true);
}

function objectEqual<T>(prop: keyof T, obj1: T, obj2: T): boolean {
    return isEqual(obj1[prop], obj2[prop]);
}

function propsEqual<T>(props: Array<keyof T>, obj1: T, obj2: T): boolean {
    // key of T?
    return props.reduce((bool: boolean, prop: keyof T) => {
        const res = bool && propEqual(prop, obj1, obj2);
        if (!res) {
            throw Error("Not matching: " + prop);
        }
        return res;
    }, true);
}

function propEqual<T>(prop: keyof T, obj1: T, obj2: T): boolean {
    return (obj1[prop] || undefined) === (obj2[prop] || undefined);
}

interface Excludes {
    [key: string]: boolean;
}
