import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn, BeforeInsert } from "typeorm";
import { v4 as uuid } from "uuid";
import logger from "../bootstrap/logger";

export class BaseModel {
    @PrimaryGeneratedColumn("uuid")
    public id?: string;

    @CreateDateColumn()
    public dateCreated?: Date;

    @UpdateDateColumn()
    public dateModified?: Date;

    @BeforeInsert()
    generateId(): void {
        if (!this.id) {
            this.id = uuid();
            logger.info(`Generated UUID for ${this.constructor.name}: ${this.id}`);
        }
    }

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
