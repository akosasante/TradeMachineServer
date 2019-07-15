import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import DraftPick from "./draftPick";
import Player from "./player";
import Team from "./team";
import Trade from "./trade";

export enum TradeItemType {
    MAJOR_PLAYER,
    MINOR_PLAYER,
    PICK,
}

@Entity()
export default class TradeItem {
    @PrimaryGeneratedColumn()
    public readonly tradeItemId: number;

    @Column({type: "enum", enum: TradeItemType, default: TradeItemType.MAJOR_PLAYER})
    public tradeItemType: TradeItemType;

    @ManyToOne(type => Trade, trade => trade.tradeParticipants)
    public trade: Trade;

    @ManyToOne(type => Player, player => player.tradeItems)
    public player?: Player;

    @ManyToOne(type => DraftPick, pick => pick.tradeItems)
    public pick?: DraftPick;

    @ManyToOne(type => Team, team => team.tradeItemsSent)
    public sender: Team;

    @ManyToOne(type => Team, team => team.tradeItemsReceived)
    public recipient: Team;

    constructor(tradeItemObj: Partial<TradeItem> = {}) {
        this.tradeItemId = tradeItemObj.tradeItemId!;
        this.tradeItemType = tradeItemObj.tradeItemType!;
        this.trade = tradeItemObj.trade!;
        this.player = tradeItemObj.player;
        this.pick = tradeItemObj.pick;
        this.sender = tradeItemObj.sender!;
        this.recipient = tradeItemObj.recipient!;
    }

    public get entity() {
        switch (this.tradeItemType) {
            case TradeItemType.MAJOR_PLAYER:
            case TradeItemType.MINOR_PLAYER:
                return this.player;
            case TradeItemType.PICK:
                return this.pick;
        }
    }

    public toString(): string {
        const entityId = this.entity ? `#${this.entity.id}` : "";
        return `TI#${this.tradeItemId}: ${this.tradeItemType}${entityId} for trade#${this.trade.id}`;
    }

    public isValid(): boolean {
        return !!this.entity;
    }
}
