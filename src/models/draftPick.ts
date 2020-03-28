import { Column, Entity, Index, ManyToOne, OneToMany } from "typeorm";
import { BaseModel } from "./base";
import { LeagueLevel } from "./player";
import Team from "./team";
import TradeItem from "./tradeItem";

@Entity()
@Index(["season", "round", "pickNumber", "type"], {unique: true})
export default class DraftPick extends BaseModel {
    @Column()
    public round!: number;

    @Column()
    public pickNumber!: number;

    @Column()
    public season!: number;

    @Column({type: "enum", enum: LeagueLevel})
    public type!: LeagueLevel;

    @ManyToOne(type => Team, team => team.draftPicks, {eager: true, onDelete: "SET NULL"})
    public currentOwner?: Team;

    @ManyToOne(type => Team, team => team.originalDraftPicks, {eager: true, onDelete: "SET NULL"})
    public originalOwner?: Team;

    @OneToMany(type => TradeItem, tradeItem => tradeItem.pick)
    public tradeItems?: TradeItem[];

    constructor(props: Partial<DraftPick> & Required<Pick<DraftPick, "season" | "pickNumber" | "round" | "type">>) {
        super();
        Object.assign(this, props);
    }
}
