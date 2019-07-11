import { Entity, OneToMany } from "typeorm";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes, HasEquals } from "./base";
import TradeItem from "./tradeItems";
import TradeParticipant from "./tradeParticipants";

@Entity()
export default class Trade extends BaseModel implements HasEquals {
    @OneToMany(type => TradeParticipant, tradeParticipants => tradeParticipants.trade)
    public tradeParticipants: TradeParticipant[];

    @OneToMany(type => TradeItem, tradeItem => tradeItem.trade)
    public tradeItems: TradeItem[];

    constructor(tradeObj: Partial<Trade> = {}) {
        super();
        Object.assign(this, {id: tradeObj.id});
        this.tradeParticipants = tradeObj.tradeParticipants!;
        this.tradeItems = tradeObj.tradeItems!;
    }

    public toString(): string {
        return `Trade#${this.id} with ${this.tradeItems.length} trade entities`;
    }

    public equals(other: Trade, excludes?: Excludes, bypassDefaults: boolean = false): boolean {
        logger.debug("Trade equals check");
        const COMPLEX_FIELDS = {tradeParticipants: true, tradeItems: true};
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
