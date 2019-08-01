import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import DraftPick from "./draftPick";
import Player, { LeagueLevel } from "./player";
import Team from "./team";
import Trade from "./trade";

export enum TradeItemType {
    PLAYER = "Player",
    PICK = "Pick",
}

@Entity()
export default class TradeItem {
    public static filterPlayers(tradeItems: TradeItem[]): TradeItem[] {
        return tradeItems.filter(item =>
            (item.tradeItemType === TradeItemType.PLAYER));
    }

    public static filterMajorPlayers(tradeItems: TradeItem[]): TradeItem[] {
        return tradeItems.filter(item =>
            item.tradeItemType === TradeItemType.PLAYER &&
            item.player && item.player.league === LeagueLevel.MAJOR
        );
    }

    public static filterMinorPlayers(tradeItems: TradeItem[]): TradeItem[] {
        return tradeItems.filter(item =>
            item.tradeItemType === TradeItemType.PLAYER &&
            item.player && item.player.league !== LeagueLevel.MAJOR
        );
    }

    public static filterPicks(tradeItems: TradeItem[]): TradeItem[] {
        return tradeItems.filter(item => item.tradeItemType === TradeItemType.PICK);
    }

    public static itemsSentBy(items: TradeItem[], sender: Team): TradeItem[] {
        return items.filter(item => item.sender.name === sender.name);
    }

    public static itemsReceivedBy(items: TradeItem[], recipient: Team): TradeItem[] {
        return items.filter(item => item.recipient.name === recipient.name);
    }

    @PrimaryGeneratedColumn()
    public readonly tradeItemId: number;

    @Column({type: "enum", enum: TradeItemType, default: TradeItemType.PLAYER})
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
            case TradeItemType.PLAYER:
                return this.player;
            case TradeItemType.PICK:
                return this.pick;
        }
    }

    public toString(): string {
        const entityId = this.entity && this.entity.id ? `#${this.entity.id}` : "";
        return `TI#${this.tradeItemId || ""}: ${this.tradeItemType}${entityId} for trade#${this.trade.id || undefined}`;
    }

    public isValid(): boolean {
        return !!this.entity;
    }
}
