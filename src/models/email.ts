import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from "typeorm";

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

    public toString(): string {
        return `${this.constructor.name}#${this.messageId}`;
    }

    public parse<T extends Email>(): Partial<T> {
        return Object.assign({}, this);
    }

    constructor(props: Partial<Email> & Required<Pick<Email, "messageId">>) {
        Object.assign(this, props);
    }
}
