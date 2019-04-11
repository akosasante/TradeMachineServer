import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes, HasEquals } from "./base";
import User from "./user";

export enum TeamStatus {
    ACTIVE = "Active",
    DISABLED = "Disabled",
}

@Entity()
export default class Team extends BaseModel implements HasEquals {

    public get publicTeam(): Team {
        const team = new Team(this);
        team.owners = (team.owners || []).map((owner: User) => owner.publicUser);
        return team;
    }
    @PrimaryGeneratedColumn()
    public readonly id?: number;

    @Column({nullable: true})
    public espnId?: number;
    // TODO: Consider enforcing uniqueness on this column? Or name column? Maybe not necessary for now.

    @Column()
    public name: string;

    @Column({type: "enum", enum: TeamStatus, default: [TeamStatus.DISABLED]})
    public status?: TeamStatus;

    @CreateDateColumn()
    public dateCreated?: Date;

    @UpdateDateColumn()
    public dateModified?: Date;

    @OneToMany(type => User, user => user.team, { eager: true, onDelete: "SET NULL"})
    public owners?: User[];

    constructor(teamObj: Partial<Team> = {}) {
        super();
        Object.assign(this, {id: teamObj.id});
        this.name = teamObj.name || "";
        this.espnId = teamObj.espnId;
        this.status = teamObj.status || TeamStatus.DISABLED;
        this.owners = teamObj.owners ? teamObj.owners.map((obj: any) =>
                new User(obj)).sort((a, b) => (a.id || 0) - (b.id || 0))
            : teamObj.owners;
    }

    public toString(): string {
        return `Team#${this.id}: ${this.name}`;
    }

    public equals(other: Team, excludes?: Excludes, bypassDefaults: boolean = false): boolean {
        logger.debug("Team equals check");
        const COMPLEX_FIELDS = {};
        const MODEL_FIELDS = {owners: true};
        const DEFAULT_EXCLUDES = {
            id: true,
            dateCreated: true,
            dateModified: true,
        };
        excludes = bypassDefaults ? excludes : Object.assign(DEFAULT_EXCLUDES, (excludes || {}));
        return BaseModel.equals(this, other, excludes, COMPLEX_FIELDS, MODEL_FIELDS);
    }

}
