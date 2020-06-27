import { Column, Entity, Index, ManyToOne } from "typeorm";
import Team from "./team";
import Trade from "./trade";
import { BaseModel } from "./base";

export enum TradeParticipantType {
    CREATOR = 1,
    RECIPIENT,
}

@Entity()
@Index(["trade", "team"], {unique: true})
export default class TradeParticipant extends BaseModel {
    @Column({type: "enum", enum: TradeParticipantType, default: TradeParticipantType.RECIPIENT})
    public participantType!: TradeParticipantType;

    @ManyToOne(type => Trade, trade => trade.tradeParticipants, {onDelete: "CASCADE"})
    public trade!: Trade;

    @ManyToOne(type => Team, team => team.tradeParticipants, {cascade: true, eager: true})
    public team!: Team;

    constructor(props: Partial<TradeParticipant> = {}) {
        super();
        Object.assign(this, props);
    }
}
