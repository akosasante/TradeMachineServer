import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import Team from "./team";
import Trade from "./trade";

export enum TradeParticipantType {
    CREATOR,
    RECIPIENT,
}

@Entity()
export default class TradeParticipant {
    @PrimaryGeneratedColumn()
    public readonly tradeParticipantId: number;

    @Column({type: "enum", enum: TradeParticipantType, default: TradeParticipantType.RECIPIENT})
    public participantType: TradeParticipantType;

    @ManyToOne(type => Trade, trade => trade.tradeParticipants)
    public trade: Trade;

    @ManyToOne(type => Team, team => team.tradeParticipants)
    public team: Team;

    constructor(tradeParticipantObj: Partial<TradeParticipant> = {}) {
        this.tradeParticipantId = tradeParticipantObj.tradeParticipantId!;
        this.participantType = tradeParticipantObj.participantType!;
        this.trade = tradeParticipantObj.trade!;
        this.team = tradeParticipantObj.team!;
    }

    public toString(): string {
        return `TP#${this.tradeParticipantId} for trade#${this.trade.id} and team#${this.team.id}`;
    }
}
