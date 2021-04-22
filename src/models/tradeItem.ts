import { Column, Entity, Index, ManyToOne } from "typeorm";
import DraftPick from "./draftPick";
import Player from "./player";
import Team from "./team";
import Trade from "./trade";
import { BaseModel } from "./base";

/* eslint-disable @typescript-eslint/naming-convention */
export enum TradeItemType {
    PLAYER = 1,
    PICK,
}
/* eslint-enable @typescript-eslint/naming-convention */

export type TradedItem = Player | DraftPick;

@Entity()
@Index(["trade", "tradeItemId", "tradeItemType", "sender", "recipient"], { unique: true })
export default class TradeItem extends BaseModel {
    public entity?: TradedItem;
    @Column({ type: "uuid" })
    public readonly tradeItemId!: string;
    @Column({ type: "enum", enum: TradeItemType, default: TradeItemType.PLAYER })
    public readonly tradeItemType!: TradeItemType;
    @ManyToOne(_type => Trade, trade => trade.tradeParticipants, { onDelete: "CASCADE" })
    public trade!: Trade;
    @ManyToOne(_type => Team, team => team.tradeItemsSent, { cascade: true, eager: true })
    public sender!: Team;
    @ManyToOne(_type => Team, team => team.tradeItemsReceived, { cascade: true, eager: true })
    public recipient!: Team;

    constructor(props: Partial<TradeItem>) {
        super();
        Object.assign(this, props);
    }

    public static filterPlayers(tradeItems?: TradeItem[]): TradeItem[] {
        return tradeItems ? tradeItems.filter(item => item.tradeItemType === TradeItemType.PLAYER) : [];
    }

    public static filterPicks(tradeItems?: TradeItem[]): TradeItem[] {
        return tradeItems ? tradeItems.filter(item => item.tradeItemType === TradeItemType.PICK) : [];
    }

    public static itemsSentBy(items: TradeItem[], sender: Team): TradeItem[] {
        return items.filter(item => item.sender.name === sender.name);
    }

    public static itemsReceivedBy(items: TradeItem[], recipient: Team): TradeItem[] {
        return items.filter(item => item.recipient.name === recipient.name);
    }
}
