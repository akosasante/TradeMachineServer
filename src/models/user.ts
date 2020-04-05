import { Column, Entity, ManyToOne, OneToMany, Unique } from "typeorm";
import { BaseModel } from "./base";
import Settings from "./settings";
import Team from "./team";

export enum Role {
    ADMIN = "admin",
    OWNER = "owner",
}

export enum UserStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
}

@Entity()
@Unique(["email"])
export default class User extends BaseModel {

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

    @OneToMany(type => Settings, setting => setting.modifiedBy)
    public updatedSettings?: Settings[];

    constructor(props: Partial<User> & Required<Pick<User, "email">>) {
        super();
        Object.assign(this, props);
    }

    public isAdmin() {
        return this.role === Role.ADMIN;
    }
}
