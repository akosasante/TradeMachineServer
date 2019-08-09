import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import Team from "./team";
import Trade from "./trade";

export enum TradeParticipantType {
    CREATOR,
    RECIPIENT,
}

@Entity()
@Index(["trade", "team"], {unique: true})
export default class TradeParticipant {
    @PrimaryGeneratedColumn()
    public readonly tradeParticipantId: number;

    @Column({type: "enum", enum: TradeParticipantType, default: TradeParticipantType.RECIPIENT})
    public participantType: TradeParticipantType;

    @ManyToOne(type => Trade, trade => trade.tradeParticipants, {onDelete: "CASCADE"})
    public trade: Trade;

    @ManyToOne(type => Team, team => team.tradeParticipants, {cascade: true, eager: true})
    public team: Team;

    constructor(tradeParticipantObj: Partial<TradeParticipant> = {}) {
        this.tradeParticipantId = tradeParticipantObj.tradeParticipantId!;
        this.participantType = tradeParticipantObj.participantType!;
        this.trade = tradeParticipantObj.trade!;
        this.team = new Team(tradeParticipantObj.team!);
    }

    public toString(): string {
        return `TP#${this.tradeParticipantId} for trade#${this.trade.id} and team#${this.team.id}`;
    }
}
