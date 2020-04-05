import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseModel } from "./base";
import User from "./user";

export interface TradeWindowSettings {
    tradeWindowStart: Date;
    tradeWindowEnd: Date;
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
    public tradeWindowStart?: Date;

    @Column({type: "time", nullable: true})
    public tradeWindowEnd?: Date;

    @Column({nullable: true})
    public downtimeStartDate?: Date;

    @Column({nullable: true})
    public downtimeEndDate?: Date;

    @Column({nullable: true})
    public downtimeReason?: string;

    @ManyToOne(type => User, user => user.updatedSettings, {onDelete: "SET NULL"})
    public modifiedBy!: User;

    constructor(props: Partial<Settings> & Required<Pick<Settings, "modifiedBy">>) {
        super();
        Object.assign(this, props);
    }
}
