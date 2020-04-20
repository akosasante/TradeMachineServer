import { Column, Entity, OneToMany, Unique } from "typeorm";
import { BaseModel } from "./base";
import DraftPick from "./draftPick";
import Player from "./player";
import TradeItem from "./tradeItem";
import TradeParticipant from "./tradeParticipant";
import User from "./user";
import { EspnFantasyTeam } from "../espn/espnApi";

export enum TeamStatus {
    ACTIVE = "active",
    DISABLED = "inactive",
}

@Entity()
@Unique(["espnId"])
export default class Team extends BaseModel {

    @Column()
    public name!: string;

    @Column({nullable: true})
    public espnId?: number;
    // TODO: Consider enforcing uniqueness on this column? Or name column? Maybe not necessary for now.

    @Column({type: "enum", enum: TeamStatus, default: [TeamStatus.DISABLED]})
    public status?: TeamStatus;

    @Column({type: "jsonb", nullable: true})
    public espnTeam?: EspnFantasyTeam;

    @OneToMany(type => User, user => user.team, { eager: true, onDelete: "SET NULL"})
    public owners?: User[];

    @OneToMany(type => Player, player => player.leagueTeam, { onDelete: "SET NULL"})
    public players?: Player[];

    @OneToMany(type => TradeParticipant, tradeParticipant => tradeParticipant.team)
    public tradeParticipants?: TradeParticipant[];

    @OneToMany(type => TradeItem, tradeItem => tradeItem.sender)
    public tradeItemsSent?: TradeItem[];

    @OneToMany(type => TradeItem, tradeItem => tradeItem.recipient)
    public tradeItemsReceived?: TradeItem[];

    @OneToMany(type => DraftPick, pick => pick.currentOwner)
    public draftPicks?: DraftPick[];

    @OneToMany(type => DraftPick, pick => pick.originalOwner)
    public originalDraftPicks?: DraftPick[];

    constructor(props: Partial<Team> & Required<Pick<Team, "name">>) {
        super();
        Object.assign(this, props);
    }

}
