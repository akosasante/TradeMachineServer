import { AfterLoad, Column, Entity, ManyToOne, Unique } from "typeorm";
import { BaseModel } from "./base";
import Team from "./team";

export enum LeagueLevel {
    MAJORS = 1,
    HIGH,
    LOW,
}

export const MinorLeagueLevels = [LeagueLevel.HIGH, LeagueLevel.LOW];

@Entity()
@Unique(["type", "season", "round", "originalOwner"])
export default class DraftPick extends BaseModel {
    @Column({type: "numeric"})
    public round!: number;

    @Column({nullable: true})
    public pickNumber!: number;

    @Column()
    public season!: number;

    @Column({type: "enum", enum: LeagueLevel})
    public type!: LeagueLevel;

    @ManyToOne(_type => Team, team => team.draftPicks, {eager: true, onDelete: "SET NULL"})
    public currentOwner?: Team;

    @ManyToOne(_type => Team, team => team.originalDraftPicks, {eager: true, onDelete: "SET NULL"})
    public originalOwner?: Team;

    constructor(props: Partial<DraftPick> & Required<Pick<DraftPick, "season" | "round" | "type">>) {
        super();
        Object.assign(this, props);
    }

    @AfterLoad()
    ensureRoundType() {
        this.round = Number(this.round);
    }

}
