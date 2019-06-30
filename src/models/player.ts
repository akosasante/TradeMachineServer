import { Column, Entity, ManyToOne } from "typeorm";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes, HasEquals } from "./base";
import Team from "./team";

export enum LeagueLevel {
    MAJOR = "Majors",
    HIGH = "High Minors",
    LOW = "Low Minors",
}

@Entity()
export default class Player extends BaseModel implements HasEquals {
    @Column()
    public name: string;

    @Column({type: "enum", enum: LeagueLevel, nullable: true})
    public league?: LeagueLevel;

    @Column({nullable: true})
    public mlbTeam?: string;

    @Column({nullable: true, type: "json"})
    public meta?: any;

    @ManyToOne(type => Team, team => team.players, {onDelete: "SET NULL"})
    public leagueTeam?: Team;

    constructor(playerObj: Partial<Player> = {}) {
        super();
        Object.assign(this, {id: playerObj.id});
        this.name = playerObj.name || "";
        this.league = playerObj.league;
        this.mlbTeam = playerObj.mlbTeam;
        this.leagueTeam = playerObj.leagueTeam;
        this.meta = playerObj.meta;
    }

    public toString(): string {
        return `MLB Player ID#${this.id}: ${this.name}`;
    }

    public equals(other: Player, excludes?: Excludes, bypassDefaults: boolean = false): boolean {
        logger.debug("MLB Player equals check");
        const COMPLEX_FIELDS = {meta: true};
        const MODEL_FIELDS = {leagueTeam: true};
        const DEFAULT_EXCLUDES = {
            id: true,
            dateCreated: true,
            dateModified: true,
        };
        excludes = bypassDefaults ? excludes : Object.assign(DEFAULT_EXCLUDES, (excludes || {}));
        return BaseModel.equals(this, other, excludes, COMPLEX_FIELDS, MODEL_FIELDS);
    }
}
