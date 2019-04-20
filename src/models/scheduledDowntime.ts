import { Entity, ManyToOne } from "typeorm";
import { Column } from "typeorm/decorator/columns/Column";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes } from "./base";
import User from "./user";

@Entity()
export default class ScheduledDowntime extends BaseModel {
    @Column()
    public startTime: Date;

    @Column()
    public endTime: Date;

    @Column({nullable: true})
    public cancelledDate?: Date;

    @Column({nullable: true})
    public reason?: string;

    @ManyToOne(type => User, user => user.createdSchedules, {onDelete: "SET NULL"})
    public createdBy?: User;

    @ManyToOne(type => User, user => user.updatedSchedules, {onDelete: "SET NULL"})
    public modifiedBy?: User;

    constructor(downtimeObj: Partial<ScheduledDowntime> = {startTime: new Date(), endTime: new Date()}) {
        super();
        Object.assign(this, {id: downtimeObj.id});
        this.startTime = typeof downtimeObj.startTime! === "string"
            ? new Date(downtimeObj.startTime!) : downtimeObj.startTime!;
        this.endTime = typeof downtimeObj.endTime! === "string" ? new Date(downtimeObj.endTime!) : downtimeObj.endTime!;
        this.cancelledDate = typeof downtimeObj.cancelledDate! === "string"
            ? new Date(downtimeObj.cancelledDate!) : downtimeObj.cancelledDate;
        this.reason = downtimeObj.reason;
        this.createdBy = downtimeObj.createdBy;
        this.modifiedBy = downtimeObj.modifiedBy;
    }

    public toString(): string {
        return `Downtime from ${this.startTime.toISOString()} to ${this.endTime.toISOString()}`;
    }

    public equals(other: ScheduledDowntime, excludes?: Excludes, bypassDefaults: boolean = false): boolean {
        logger.debug("Scheduled downtime equals check");
        const COMPLEX_FIELDS = {
            startTime: true,
            endTime: true,
            cancelledDate: true,
        };
        const MODEL_FIELDS = {};
        const DEFAULT_EXCLUDES = {
            id: true,
            dateCreated: true,
            dateModified: true,
        };
        excludes = bypassDefaults ? excludes : Object.assign(DEFAULT_EXCLUDES, (excludes || {}));
        return BaseModel.equals(this, other, excludes, COMPLEX_FIELDS, MODEL_FIELDS);
    }
}
