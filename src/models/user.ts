import { compare, hash } from "bcryptjs";
import { Column, CreateDateColumn, Entity, Generated, ManyToOne, Unique, UpdateDateColumn } from "typeorm";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes } from "./base";
import Team from "./team";

export enum Role {
    ADMIN = "Admin",
    OWNER = "Owner",
}

export enum UserStatus {
    ACTIVE = "Active",
    INACTIVE = "Inactive",
}

@Entity()
@Unique(["email"])
export default class User extends BaseModel {
    public get publicUser(): User {
        const user = new User(this);
        user.password = undefined;
        return user;
    }

    public static async generateHashedPassword(plainPassword: string): Promise<string> {
        logger.debug("hashing password");
        const saltFactor = process.env.NODE_ENV !== "production" ? 1 : 15;
        return hash(plainPassword, saltFactor)
            .then(pass => pass)
            .catch(err => err);
    }

    public static generateTimeToPasswordExpires() {
        return new Date(Date.now() + User.TIME_TO_EXPIRE_PASSWORD_MS);
    }

    public static sanitizeUUID(uuid: string) {
        return uuid.replace(/-/g, "");
    }

    private static TIME_TO_EXPIRE_PASSWORD_MS = 1 * 60 * 60 * 1000;  // 1 hr * 60 min/hr * 60 s/min * 1000ms/s

    // public static defaultPassword() {
    //     return "trade_machine_new_user";
    // }

    // public static isUser(userObj: any): userObj is User {
    //     return (userObj as User).email !== undefined;
    // }

    @Column()
    public email?: string;

    @Column({nullable: true})
    public password?: string;

    @Column({nullable: true})
    public name?: string;

    @Column({nullable: true})
    public username?: string;

    @Column({type: "enum", enum: Role, array: true, default: [Role.OWNER]})
    public roles?: Role[];

    @Column({nullable: true})
    public lastLoggedIn?: Date;

    @Column()
    @Generated("uuid")
    public userIdToken?: string;

    @Column({nullable: true})
    public passwordResetExpiresOn?: Date;

    @Column({type: "enum", enum: UserStatus, default: UserStatus.ACTIVE})
    public status?: UserStatus;

    @ManyToOne(type => Team, team => team.owners, {onDelete: "SET NULL"})
    public team?: Team;

    public hasPassword?: boolean;

    constructor(userObj: Partial<User> = {}) {
        super();
        this.password = userObj.password;
        this.username = userObj.username;
        this.lastLoggedIn = userObj.lastLoggedIn;
        this.email = userObj.email;
        this.dateCreated = userObj.dateCreated;
        this.dateModified = userObj.dateModified;
        Object.assign(this, {id: userObj.id});
        this.name = userObj.name;
        this.roles = userObj.roles;
        this.hasPassword = !!this.password;
        this.userIdToken = userObj.userIdToken;
        this.passwordResetExpiresOn = userObj.passwordResetExpiresOn;
        this.team = userObj.team;
        this.status = userObj.status || UserStatus.ACTIVE;
    }

    // Couldn't get this to work for whatever reason so just hashing in the DAO itself.
    // @BeforeInsert()
    // public async setHashedPassword() {
    //     logger.debug("HASHING ON INSERT");
    //     this.password = this.password ? await User.generateHashedPassword(this.password) : this.password;
    // }

    public async isPasswordMatching(password: string): Promise<boolean> {
        logger.debug(`comparing ${password} to ${this.password}`);
        return compare(password, this.password || "");
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

    public equals(other: User, excludes?: Excludes, bypassDefaults: boolean = false): boolean {
        logger.debug("User equals check");
        const COMPLEX_FIELDS = {roles: true};
        const DEFAULT_EXCLUDES = {
            id: true,
            password: true,
            userIdToken: true,
            lastLoggedIn: true,
            dateCreated: true,
            dateModified: true,
        };
        excludes = bypassDefaults ? excludes : Object.assign(DEFAULT_EXCLUDES, (excludes || {}));
        return BaseModel.equals(this, other, excludes, COMPLEX_FIELDS);
    }
}
