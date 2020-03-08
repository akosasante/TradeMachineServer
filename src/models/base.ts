import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
// import {v4 as uuid} from "uuid/v4";

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
}