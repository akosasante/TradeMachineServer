import { Column, Entity, Index, ManyToOne, OneToMany } from "typeorm";
import { BaseModel } from "./base";
import Team from "./team";
import TradeItem from "./tradeItem";

export enum LeagueLevel {
    MAJOR = "Majors",
    HIGH = "High Minors",
    LOW = "Low Minors",
}

@Entity()
export default class Player extends BaseModel {
    @Column()
    @Index()
    public name!: string;

    @Column({type: "enum", enum: LeagueLevel, nullable: true})
    public league?: LeagueLevel;

    @Column({nullable: true})
    public mlbTeam?: string;

    @Column({nullable: true, type: "json"})
    public meta?: any;

    @ManyToOne(type => Team, team => team.players, {onDelete: "SET NULL"})
    public leagueTeam?: Team;

    @OneToMany(type => TradeItem, tradeItem => tradeItem.player)
    public tradeItems?: TradeItem[];

    constructor(props: Partial<Player> & Required<Pick<Player, "name">>) {
        super();
        Object.assign(this, props);
    }
}
