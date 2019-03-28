import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { BaseModel, Excludes } from "./base";
import User from "./user";

@Entity()
export default class Team extends BaseModel {
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

    public equals(other: Team, excludes: Excludes = {}): boolean {
        const COMPLEX_FIELDS = {owners: true};
        const DEFAULT_EXCLUDES = {
            id: true,
            dateCreated: true,
            dateModified: true,
        };
        return BaseModel.equals(this, other, excludes || DEFAULT_EXCLUDES, COMPLEX_FIELDS);
    }

}
