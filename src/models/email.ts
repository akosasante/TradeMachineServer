import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryColumn, UpdateDateColumn } from "typeorm";
import Trade from "./trade";

@Entity()
export default class Email {
    @PrimaryColumn()
    public messageId!: string;

    @Column()
    @Index()
    public status?: string;

    @CreateDateColumn()
    public dateCreated?: Date;

    @UpdateDateColumn()
    public dateModified?: Date;

    @ManyToOne(_type => Trade, trade => trade.tradeParticipants, { onDelete: "SET NULL", nullable: true })
    public trade!: Trade;

    constructor(props: Partial<Email> & Required<Pick<Email, "messageId">>) {
        Object.assign(this, props);
    }

    public toString(): string {
        return `${this.constructor.name}#${this.messageId}`;
    }

    public parse<T extends Email>(): Partial<T> {
        return Object.assign({}, this);
    }
}
