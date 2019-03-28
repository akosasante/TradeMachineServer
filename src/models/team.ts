import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { BaseModel, Excludes } from "./base";
import User from "./user";

@Entity()
export default class Team extends BaseModel {

    public get publicTeam(): Team {
        const team = new Team(this);
        team.owners = (team.owners || []).map((owner: User) => owner.publicUser);
        return team;
    }
    @PrimaryGeneratedColumn()
    public readonly id?: number;

    @Column()
    public espnId?: number;

    @Column()
    public name: string;

    @CreateDateColumn()
    public dateCreated?: Date;

    @UpdateDateColumn()
    public dateModified?: Date;

    @OneToMany(type => User, user => user, { eager: true, onDelete: "SET NULL"})
    public owners?: User[];

    constructor(teamObj: Partial<Team> = {}) {
        super();
        Object.assign(this, {id: teamObj.id});
        this.name = teamObj.name || "";
        this.espnId = teamObj.espnId;
        this.owners = teamObj.owners;
    }

    public toString(): string {
        return `Team#${this.id}: ${this.name}`;
    }

    public equals(other: Team, excludes?: Excludes, bypassDefaults: boolean = false): boolean {
        const COMPLEX_FIELDS = {owners: true};
        const DEFAULT_EXCLUDES = {
            id: true,
            dateCreated: true,
            dateModified: true,
        };
        excludes = bypassDefaults ? excludes : Object.assign(DEFAULT_EXCLUDES, (excludes || {}));
        return BaseModel.equals(this, other, excludes, COMPLEX_FIELDS);
    }

}
