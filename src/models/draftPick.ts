import { Column, Entity, Index, ManyToOne, OneToMany } from "typeorm";
import { BaseModel } from "./base";
import { LeagueLevel } from "./player";
import Team from "./team";
import TradeItem from "./tradeItem";

@Entity()
@Index(["type", "season", "round", "currentOwner"], {unique: true})
export default class DraftPick extends BaseModel {
    @Column()
    public round!: number;

    @Column({nullable: true})
    public pickNumber!: number;

    @Column()
    public season!: number;

    @Column({type: "enum", enum: LeagueLevel})
    public type!: LeagueLevel;

    @ManyToOne(type => Team, team => team.draftPicks, {eager: true, onDelete: "SET NULL"})
    public currentOwner?: Team;

    @ManyToOne(type => Team, team => team.originalDraftPicks, {eager: true, onDelete: "SET NULL"})
    public originalOwner?: Team;

    constructor(props: Partial<DraftPick> & Required<Pick<DraftPick, "season" | "round" | "type">>) {
        super();
        Object.assign(this, props);
    }
}
