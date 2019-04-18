import { Entity, ManyToOne } from "typeorm";
import { Column } from "typeorm/decorator/columns/Column";
import { BaseModel } from "./base";
import User from "./user";

@Entity()
export default class ScheduledDowntime extends BaseModel {
    @Column()
    public startTime: Date;

    @Column()
    public endTime: Date;

    @Column()
    public cancelledDate?: Date;

    @Column()
    public reason?: string;

    @ManyToOne(type => User, user => user.createdSchedules, {onDelete: "SET NULL"})
    public createdBy?: User;

    @ManyToOne(type => User, user => user.updatedSchedules, {onDelete: "SET NULL"})
    public modifiedBy?: User;

    constructor(downtimeObj: Partial<ScheduledDowntime> = {startTime: new Date(), endTime: new Date()}) {
        super();
        Object.assign(this, {id: downtimeObj.id});
        this.startTime = downtimeObj.startTime!;
        this.endTime = downtimeObj.endTime!;
        this.cancelledDate = downtimeObj.cancelledDate;
        this.reason = downtimeObj.reason;
        this.createdBy = downtimeObj.createdBy;
        this.modifiedBy = downtimeObj.modifiedBy;
    }

    public toString(): string {
        return `Downtime from ${this.startTime.toISOString()} to ${this.endTime.toISOString()}`;
    }
}
