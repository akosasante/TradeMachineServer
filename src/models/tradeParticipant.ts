import { Column, Entity, Index, ManyToOne } from "typeorm";
import Team from "./team";
import Trade from "./trade";
import { BaseModel } from "./base";

/* eslint-disable @typescript-eslint/naming-convention */
export enum TradeParticipantType {
    CREATOR = 1,
    RECIPIENT,
}
/* eslint-enable @typescript-eslint/naming-convention */

@Entity()
@Index(["trade", "team"], { unique: true })
@Index(["team"])
@Index(["participantType"])
@Index("trade_creator_index", { synchronize: false })
@Index("trade_recipient_index", { synchronize: false })
export default class TradeParticipant extends BaseModel {
    @Column({ type: "enum", enum: TradeParticipantType, default: TradeParticipantType.RECIPIENT })
    public participantType!: TradeParticipantType;

    @ManyToOne(_type => Trade, trade => trade.tradeParticipants, { onDelete: "CASCADE" })
    public trade!: Trade;

    @ManyToOne(_type => Team, team => team.tradeParticipants, { cascade: true, eager: true })
    public team!: Team;

    constructor(props: Partial<TradeParticipant> = {}) {
        super();
        Object.assign(this, props);
    }
}
