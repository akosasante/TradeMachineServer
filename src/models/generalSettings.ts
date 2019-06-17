import { Column, Entity, ManyToOne } from "typeorm";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes } from "./base";
import User from "./user";

export enum TradeDeadlineStatus {
    ON = "ON",
    OFF = "OFF",
}

interface TradeDeadlineSetting {
    status: TradeDeadlineStatus;
    startTime: Date;
    endTime: Date;
}

@Entity()
export default class GeneralSettings extends BaseModel {
    public static ensureDated(deadline: TradeDeadlineSetting): TradeDeadlineSetting {
        const startTime = deadline.startTime ? new Date(deadline.startTime) : deadline.startTime;
        const endTime = deadline.endTime ? new Date(deadline.endTime) : deadline.endTime;
        return {...deadline, startTime, endTime};
    }
    @Column("jsonb")
    public deadline: TradeDeadlineSetting;

    @ManyToOne(type => User, user => user.updatedSettings, {onDelete: "SET NULL"})
    public modifiedBy: User;

    constructor(settingsObj: Partial<GeneralSettings>) {
        super();
        Object.assign(this, {id: (settingsObj || {}).id});
        this.deadline = settingsObj.deadline ? GeneralSettings.ensureDated(settingsObj.deadline) :
            ({} as GeneralSettings).deadline;
        this.modifiedBy = settingsObj.modifiedBy ? new User(settingsObj.modifiedBy!) :
            ({} as GeneralSettings).modifiedBy;
    }

    public toString(): string {
        const lastModifiedString = `Last changed by ${this.modifiedBy}`;
        return `General Settings: Deadline Status: ${this.deadline.status}, \
        ${this.modifiedBy ? lastModifiedString : ""}`;
    }

    public equals(other: GeneralSettings, excludes?: Excludes, bypassDefaults: boolean = false): boolean {
        logger.debug("General settings equals check");
        const COMPLEX_FIELDS = {
            deadline: true,
        };
        const MODEL_FIELDS = {
            modifiedBy: true,
        };
        const DEFAULT_EXCLUDES = {
            id: true,
            dateCreated: true,
            dateModified: true,
        };
        excludes = bypassDefaults ? excludes : Object.assign(DEFAULT_EXCLUDES, (excludes || {}));
        return BaseModel.equals(this, other, excludes, COMPLEX_FIELDS, MODEL_FIELDS);
    }
}
