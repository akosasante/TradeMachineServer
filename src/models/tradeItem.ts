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

    @ManyToOne(type => Trade, trade => trade.tradeParticipants, {onDelete: "CASCADE"})
    public trade: Trade;

    @ManyToOne(type => Player, player => player.tradeItems, {cascade: true, eager: true})
    public player?: Player;

    @ManyToOne(type => DraftPick, pick => pick.tradeItems, {cascade: true, eager: true})
    public pick?: DraftPick;

    @ManyToOne(type => Team, team => team.tradeItemsSent, {cascade: true, eager: true})
    public sender: Team;

    @ManyToOne(type => Team, team => team.tradeItemsReceived, {cascade: true, eager: true})
    public recipient: Team;

    constructor(tradeItemObj: Partial<TradeItem> = {}) {
        this.tradeItemId = tradeItemObj.tradeItemId!;
        this.tradeItemType = tradeItemObj.tradeItemType!;
        this.trade = tradeItemObj.trade!;
        this.player = tradeItemObj.player ? new Player(tradeItemObj.player) : undefined;
        this.pick = tradeItemObj.pick ? new DraftPick(tradeItemObj.pick) : undefined;
        this.sender = new Team(tradeItemObj.sender!);
        this.recipient = new Team(tradeItemObj.recipient!);
    }

    public get entity(): Player|DraftPick|undefined {
        switch (this.tradeItemType) {
            case TradeItemType.PLAYER:
                if (this.player) {
                    return this.player instanceof Player ? this.player : new Player(this.player);
                }
                break;
            case TradeItemType.PICK:
                if (this.pick) {
                    return this.pick instanceof DraftPick ? this.pick : new DraftPick(this.pick);
                }
                break;
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
