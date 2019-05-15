import { Column, Entity, ManyToOne } from "typeorm";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes } from "./base";
import User from "./user";

interface TradeDeadlineSetting {
    status: "ON"|"OFF";
    startTime: Date;
    endTiime: Date;
}

@Entity()
export default class GeneralSettings extends BaseModel {
    @Column("jsonb")
    public deadline: TradeDeadlineSetting;

    @ManyToOne(type => User, user => user.updatedSettings, {onDelete: "SET NULL"})
    public modifiedBy: User;

    constructor(settingsObj: Partial<GeneralSettings>) {
        super();
        Object.assign(this, {id: (settingsObj || {}).id});
        this.deadline = (settingsObj || {}).deadline!;
        this.modifiedBy = (settingsObj || {}).modifiedBy!;
    }

    public toString(): string {
        return `General Settings: Deadline Status: ${this.deadline.status}, Last changed by ${this.modifiedBy}`;
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
