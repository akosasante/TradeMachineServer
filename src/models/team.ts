import { Team } from "@akosasante/trade-machine-models";
import { Column, Entity, OneToMany } from "typeorm";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes, HasEquals } from "./base";
import DraftPick from "./draftPick";
import Player from "./player";
import TradeItem from "./tradeItem";
import TradeParticipant from "./tradeParticipant";
import UserDO from "./user";

export enum TeamStatus {
    ACTIVE = "active",
    DISABLED = "inactive",
}

@Entity()
export default class TeamDO extends BaseModel implements HasEquals {

    @Column({nullable: true})
    public espnId?: number;
    // TODO: Consider enforcing uniqueness on this column? Or name column? Maybe not necessary for now.

    @Column()
    public name: string;

    @Column({type: "enum", enum: TeamStatus, default: [TeamStatus.DISABLED]})
    public status?: TeamStatus;

    @OneToMany(type => UserDO, user => user.team, { eager: true, onDelete: "SET NULL"})
    public owners?: UserDO[];

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

    constructor(teamObj: Partial<TeamDO> = {}) {
        super();
        Object.assign(this, {id: teamObj.id});
        this.name = teamObj.name || "";
        this.espnId = teamObj.espnId;
        this.status = teamObj.status || TeamStatus.DISABLED;
        this.owners = teamObj.owners ? teamObj.owners
                .map((obj: any) => new UserDO(obj))
                .sort((a, b) => (a.id || "0").localeCompare(b.id || "0"))
            : teamObj.owners;
        this.players = teamObj.players ? teamObj.players.map((obj: any) => new Player(obj)) : teamObj.players;
        this.tradeParticipants = teamObj.tradeParticipants;
        this.tradeItemsReceived = teamObj.tradeItemsReceived;
        this.tradeItemsSent = teamObj.tradeItemsSent;
        this.draftPicks = teamObj.draftPicks;
        this.originalDraftPicks = teamObj.originalDraftPicks;
    }

    public toTeamModel(): Team {
        if (this.id && this.name) {
            return new Team(
                this.id,
                this.name,
                this.status,
                this.espnId
            );
        } else {
            throw new Error("Invalid Team Model inputs");
        }
    }

    public equals(other: TeamDO, excludes?: Excludes, bypassDefaults: boolean = false): boolean {
        logger.debug("Team equals check");
        const COMPLEX_FIELDS = {
            tradeParticipants: true,
            tradeItemsReceived: true,
            tradeItemsSent: true,
            draftPicks: true,
            originalDraftPicks: true,
        };
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
