import { compare, hash } from "bcryptjs";
import { User } from "trade-machine-models/lib";
import { Column, Entity, Generated, Index, ManyToOne, OneToMany, Unique } from "typeorm";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes } from "./base";
import GeneralSettings from "./generalSettings";
import ScheduledDowntime from "./scheduledDowntime";
import Team from "./team";

export enum Role {
    ADMIN = "admin",
    OWNER = "owner",
}

export enum UserStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
}

@Entity("User")
@Unique(["email"])
export default class UserDO extends BaseModel {
    // public get publicUser(): User {
    //     const user = new User(this);
    //     user.password = undefined;
    //     return user;
    // }
    //
    // public static async generateHashedPassword(plainPassword: string): Promise<string> {
    //     logger.debug("hashing password");
    //     const saltFactor = process.env.NODE_ENV !== "production" ? 1 : 15;
    //     return hash(plainPassword, saltFactor)
    //         .then(pass => pass)
    //         .catch(err => err);
    // }
    //
    // public static generateTimeToPasswordExpires() {
    //     return new Date(Date.now() + User.TIME_TO_EXPIRE_PASSWORD_MS);
    // }
    //
    // public static sanitizeUUID(uuid: string) {
    //     return uuid.replace(/-/g, "");
    // }
    //
    // private static TIME_TO_EXPIRE_PASSWORD_MS = 1 * 60 * 60 * 1000;  // 1 hr * 60 min/hr * 60 s/min * 1000ms/s

    // public static defaultPassword() {
    //     return "trade_machine_new_user";
    // }

    // public static isUser(userObj: any): userObj is User {
    //     return (userObj as User).email !== undefined;
    // }

    @Column()
    @Index({unique: true})
    public email?: string;

    @Column({nullable: true})
    public password?: string;

    @Column()
    public displayName?: string;

    @Column({nullable: true})
    public slackUsername?: string;

    @Column({ type: "enum", enum: Role, default: Role.OWNER })
    public role?: Role;

    @Column({nullable: true})
    public lastLoggedIn?: Date;

    @Column({nullable: true})
    public passwordResetExpiresOn?: Date;

    @Column({nullable: true})
    public passwordResetToken?: string;

    @Column({ type: "enum", enum: UserStatus, default: UserStatus.ACTIVE })
    public status?: UserStatus;

    @ManyToOne(type => Team, team => team.owners, {onDelete: "SET NULL"})
    public team?: Team;

    @OneToMany(type => ScheduledDowntime, schedule => schedule.createdBy)
    public createdSchedules?: ScheduledDowntime[];

    @OneToMany(type => ScheduledDowntime, schedule => schedule.modifiedBy)
    public updatedSchedules?: ScheduledDowntime[];

    @OneToMany(type => GeneralSettings, setting => setting.modifiedBy)
    public updatedSettings?: GeneralSettings[];

    // public hasPassword?: boolean;

    constructor(userObj: Partial<UserDO> = {}) {
        super(userObj.id);
        this.password = userObj.password;
        this.displayName = userObj.displayName;
        this.email = userObj.email;
        this.role = userObj.role;
        this.status = userObj.status;
        this.slackUsername = userObj.slackUsername;
        this.lastLoggedIn = userObj.lastLoggedIn;
        this.dateCreated = userObj.dateCreated;
        this.dateModified = userObj.dateModified;
        // this.hasPassword = !!this.password;
        // this.userIdToken = userObj.userIdToken;
        this.passwordResetExpiresOn = userObj.passwordResetExpiresOn;
        this.passwordResetToken = userObj.passwordResetToken;
        this.team = userObj.team;
        this.createdSchedules = userObj.createdSchedules;
        this.updatedSchedules = userObj.updatedSchedules;
        this.updatedSettings = userObj.updatedSettings;
    }

    // Couldn't get this to work for whatever reason so just hashing in the DAO itself.
    // @BeforeInsert()
    // public async setHashedPassword() {
    //     logger.debug("HASHING ON INSERT");
    //     this.password = this.password ? await User.generateHashedPassword(this.password) : this.password;
    // }

    // public async isPasswordMatching(password: string): Promise<boolean> {
    //     logger.debug(`comparing ${password} to ${this.password}`);
    //     return compare(password, this.password || "");
    // }

    // public toString(): string {
    //     return `User#${this.id}`;
    // }

    // public isAdmin(): boolean {
    //     return this.hasRole(Role.ADMIN);
    // }
    //
    // public hasRole(role: Role): boolean {
    //     return (this.roles || []).includes(role);
    // }

    // public passwordResetIsValid(): boolean {
    //     if (this.passwordResetExpiresOn) {
    //         const dateOfExpiry = new Date(this.passwordResetExpiresOn);
    //         logger.debug(dateOfExpiry);
    //         return (dateOfExpiry.valueOf() - Date.now()) >= 0;
    //     } else {
    //         return false;
    //     }
    // }

    public toUserModel() {
        if (this.id && this.displayName && this.email) {
            return new User(
                this.id,
                !!this.password,
                this.displayName,
                this.email,
                this.role,
                this.status,
                this.slackUsername,
                this.lastLoggedIn
            );
        } else {
            throw new Error("Invalid User Model inputs");
        }
    }

    public equals(other: UserDO, excludes?: Excludes, bypassDefaults: boolean = false): boolean {
        logger.debug("User equals check");
        const COMPLEX_FIELDS = {roles: true};
        const MODEL_FIELDS = {
            team: true,
            createdSchedules: true,
            updatedSchedules: true,
            updatedSettings: true,
        };
        const DEFAULT_EXCLUDES = {
            id: true,
            password: true,
            userIdToken: true,
            lastLoggedIn: true,
            dateCreated: true,
            dateModified: true,
            createdSchedules: true,
            updatedSchedules: true,
            updatedSettings: true,
            passwordResetExpiresOn: true,
            passwordResetToken: true,
        };
        excludes = bypassDefaults ? excludes : Object.assign(DEFAULT_EXCLUDES, (excludes || {}));
        return BaseModel.equals(this, other, excludes, COMPLEX_FIELDS, MODEL_FIELDS);
    }
}
