import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export class BaseModel {
    @PrimaryGeneratedColumn("uuid")
    public readonly id?: string;

    @CreateDateColumn()
    public dateCreated?: Date;

    @UpdateDateColumn()
    public dateModified?: Date;

    public toString(): string {
        return `${this.constructor.name}#${this.id}`;
    }

    public parse<T extends BaseModel>(): Partial<T> {
        return Object.assign({}, this);
    }

    static getKeyByValue(enumField: { [s: string]: unknown }, value: unknown): string | undefined {
        if (value) {
            const indexOfS = Object.values(enumField).indexOf(value as unknown as typeof enumField);

            return Object.keys(enumField)[indexOfS];
        } else {
            return undefined;
        }
    }
}
