import { Entity, OneToMany } from "typeorm";
import logger from "../bootstrap/logger";
import { BaseModel, Excludes, HasEquals } from "./base";
import DraftPick from "./draftPick";
import Player from "./player";
import Team from "./team";
import TradeItem from "./tradeItem";
import TradeParticipant, { TradeParticipantType } from "./tradeParticipant";

@Entity()
export default class Trade extends BaseModel implements HasEquals {

    public get creator(): Team|undefined {
        const creator = this.tradeParticipants.find(part =>
            part.participantType === TradeParticipantType.CREATOR);
        return creator ? creator.team : undefined;
    }

    public get recipients(): Team[] {
        return this.tradeParticipants
            .filter(part => part.participantType === TradeParticipantType.RECIPIENT)
            .map(part => part.team);
    }

    public get players(): Player[] {
        return TradeItem.filterPlayers(this.tradeItems)
            .map(item => item.entity as Player);
    }

    public get majorPlayers(): Player[] {
        return TradeItem.filterMajorPlayers(this.tradeItems)
            .map(item => item.entity as Player);
    }

    public get minorPlayers(): Player[] {
        return TradeItem.filterMinorPlayers(this.tradeItems)
            .map(item => item.entity as Player);
    }

    public get picks(): DraftPick[] {
        return TradeItem.filterPicks(this.tradeItems)
            .map(item => item.entity as DraftPick);
    }
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

    public isValid(): boolean {
        const participantsAndItemsExist = !!this.tradeParticipants && !!this.tradeItems;
        if (!participantsAndItemsExist) {
            return false;
        }
        const participantsAndItemsLength = !!this.tradeParticipants.length && !!this.tradeItems.length;
        const recipientExists = !!this.recipients.length;
        const creatorExists = !!this.creator;
        const onlyOneCreator = this.tradeParticipants.filter(part =>
            part.participantType === TradeParticipantType.CREATOR).length === 1;
        return participantsAndItemsExist && participantsAndItemsLength &&
            recipientExists && creatorExists && onlyOneCreator;
    }

    /*
    Trade {
    id: 1,
    participants: ["Akosua" (Creator), "Kwasi" (Recipient), "Cam" (Recipient)],
    items: ["Honus Wagner", "Mini Bobby", "Lil Yachty", Albert Pujols", "PickA", "PickB"]
     */

    /*
      { tradeId: 1,
      majorleague: [ {player, from, to} ],
      minorleage: [...],
      picks: [...] }
    */
    public mapByTradeItemType(): object {
        return {
            tradeId: this.id,
            majorLeaguePlayers: TradeItem.filterMajorPlayers(this.tradeItems),
            minorLeaguePlayers: TradeItem.filterMinorPlayers(this.tradeItems),
            picks: TradeItem.filterPicks(this.tradeItems),
        };
    }

    /*
      { tradeId: 1,
      from1: [ {player, from, to} ],
      from2: [...],
    */
    public mapBySender(): object {
        const senders = Array.from(new Set(this.tradeItems.map(item => item.sender)));
        return senders.reduce((tradeMap, sender) => {
            // @ts-ignore
            tradeMap[sender.name] = TradeItem.itemsSentBy(this.tradeItems, sender);
            return tradeMap;
        }, { tradeId: this.id });
    }

    /*
  { tradeId: 1,
  to1: [ {player, from, to} ],
  to2: [...],
    */
    public mapByRecipient(): object {
        const recipients = Array.from(new Set(this.tradeItems.map(item => item.recipient)));
        return recipients.reduce((tradeMap, recipient) => {
            // @ts-ignore
            tradeMap[recipient.name] = TradeItem.itemsReceivedBy(this.tradeItems, recipient);
            return tradeMap;
        }, { tradeId: this.id });
    }
}
