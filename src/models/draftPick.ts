import { Column, Entity, ManyToOne, OneToMany } from "typeorm";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes, HasEquals } from "./base";
import { LeagueLevel } from "./player";
import TradeItem from "./tradeItems";
import User from "./user";

@Entity()
export default class DraftPick extends BaseModel implements HasEquals {
    @Column()
    public round: number; // can we force only inserting unique round+picknum+season?

    @Column({nullable: true})
    public pickNumber?: number;

    @Column({nullable: true})
    public season?: number;

    @Column({type: "enum", enum: LeagueLevel})
    public type: LeagueLevel;

    @ManyToOne(type => User, user => user.draftPicks, {eager: true, onDelete: "SET NULL"})
    public currentOwner?: User;

    @ManyToOne(type => User, user => user.originalDraftPicks, {eager: true, onDelete: "SET NULL"})
    public originalOwner?: User;

    @OneToMany(type => TradeItem, tradeItem => tradeItem.pick)
    public tradeItems?: TradeItem[];

    constructor(draftPickObj: Partial<DraftPick> = {}) {
        super();
        Object.assign(this, {id: draftPickObj.id});
        this.round = draftPickObj.round!;
        this.pickNumber = draftPickObj.pickNumber;
        this.season = draftPickObj.season;
        this.type = draftPickObj.type!;
        this.currentOwner = draftPickObj.currentOwner;
        this.originalOwner = draftPickObj.originalOwner;
        this.tradeItems = draftPickObj.tradeItems;
    }

    public toString(): string {
        const currentOwner = this.currentOwner ? `. Currently owned by: ${this.currentOwner}` : "";
        return `${this.type} draft pick, round: ${this.round}, pick #${this.pickNumber}${currentOwner}`;
    }

    public equals(other: DraftPick, excludes?: Excludes, bypassDefaults: boolean = false): boolean {
        logger.debug("Draft pick equals check");
        const COMPLEX_FIELDS = {tradeItems: true};
        const MODEL_FIELDS = {currentOwner: true, originalOwner: true};
        const DEFAULT_EXCLUDES = {
            id: true,
            dateCreated: true,
            dateModified: true,
        };
        excludes = bypassDefaults ? excludes : Object.assign(DEFAULT_EXCLUDES, (excludes || {}));
        return BaseModel.equals(this, other, excludes, COMPLEX_FIELDS, MODEL_FIELDS);
    }
}
