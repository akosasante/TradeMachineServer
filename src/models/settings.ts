import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseModel } from "./base";
import User from "./user";

export interface TradeWindowSettings {
    tradeWindowStart: string;
    tradeWindowEnd: string;
}

export interface DowntimeSettings {
    downtimeStartDate: Date;
    downtimeEndDate: Date;
    downtimeReason: string;
}

@Entity()
@Index(["tradeWindowStart", "tradeWindowEnd", "modifiedBy"])
@Index(["downtimeStartDate", "downtimeEndDate", "downtimeReason", "modifiedBy"])
export default class Settings extends BaseModel {
    @Column({type: "time", nullable: true})
    public tradeWindowStart?: string;

    @Column({type: "time", nullable: true})
    public tradeWindowEnd?: string;

    @Column({nullable: true})
    public downtimeStartDate?: Date;

    @Column({nullable: true})
    public downtimeEndDate?: Date;

    @Column({nullable: true})
    public downtimeReason?: string;

    @ManyToOne(type => User, user => user.updatedSettings, {onDelete: "SET NULL", eager: true})
    public modifiedBy!: User;

    constructor(props: Partial<Settings> & Required<Pick<Settings, "modifiedBy">>) {
        super();
        Object.assign(this, props);
    }
}
