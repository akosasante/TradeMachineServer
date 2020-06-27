import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseModel } from "./base";
import User from "./user";

export interface TradeWindowSettings {
    tradeWindowStart: string;
    tradeWindowEnd: string;
}

export interface DowntimeSettings {
    scheduled: DowntimeSetting[];
}

export interface DowntimeSetting {
    downtimeStartDate: Date;
    downtimeEndDate: Date;
    downtimeReason: string;
}

@Entity()
@Index(["tradeWindowStart", "tradeWindowEnd", "modifiedBy"])
@Index(["downtime", "modifiedBy"])
@Index(["modifiedBy"])
export default class Settings extends BaseModel {
    @Column({type: "time", nullable: true})
    public tradeWindowStart?: Date;

    @Column({type: "time", nullable: true})
    public tradeWindowEnd?: Date;

    @Column({nullable: true, type: "jsonb"})
    public downtime?: DowntimeSettings;

    @ManyToOne(type => User, user => user.updatedSettings, {onDelete: "SET NULL", eager: true})
    public modifiedBy!: User;

    constructor(props: Partial<Settings> & Required<Pick<Settings, "modifiedBy">>) {
        super();
        Object.assign(this, props);
    }
}
