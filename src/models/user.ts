import { Column, Entity, ManyToOne, OneToMany, Unique } from "typeorm";
import { BaseModel } from "./base";
import Settings from "./settings";
import Team from "./team";
import { EspnLeagueMember } from "../espn/espnApi";

export enum Role {
    ADMIN = 1,
    OWNER,
    COMMISSIONER,
}

export enum UserStatus {
    ACTIVE = 1,
    INACTIVE,
}

export const TIME_TO_EXPIRE_USER_PASSWORD_IN_MS = 1 * 60 * 60 * 1000; // 1 hr * 60 min/hr * 60 s/min * 1000ms/s

@Entity()
@Unique(["email"])
export default class User extends BaseModel {
    private static TIME_TO_EXPIRE_PASSWORD_MS: number = TIME_TO_EXPIRE_USER_PASSWORD_IN_MS;  // password expires in 1 hour after being set
    @Column()
    public email!: string;
    @Column({nullable: true, select: false})
    public password?: string;
    @Column({nullable: true})
    public displayName?: string;
    @Column({nullable: true})
    public slackUsername?: string;
    @Column({nullable: true})
    public csvName?: string;
    @Column({type: "enum", enum: Role, default: Role.OWNER})
    public role?: Role;
    @Column({nullable: true})
    public lastLoggedIn?: Date;
    @Column({nullable: true})
    public passwordResetExpiresOn?: Date;
    @Column({nullable: true})
    public passwordResetToken?: string;
    @Column({type: "enum", enum: UserStatus, default: UserStatus.ACTIVE})
    public status?: UserStatus;
    @Column({type: "jsonb", nullable: true})
    public espnMember?: EspnLeagueMember;
    @ManyToOne(_type => Team, team => team.owners, {onDelete: "SET NULL"})
    public team?: Team;
    @OneToMany(_type => Settings, setting => setting.modifiedBy)
    public updatedSettings?: Settings[];

    constructor(props: Partial<User> & Required<Pick<User, "email">>) {
        super();
        Object.assign(this, props);
    }

    public static generateTimeToPasswordExpires(dateMs: number = Date.now()) {
        return new Date(dateMs + User.TIME_TO_EXPIRE_PASSWORD_MS);
    }

    public isAdmin() {
        return this.role === Role.ADMIN;
    }
}
