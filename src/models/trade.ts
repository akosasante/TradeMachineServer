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
    @OneToMany(type => TradeParticipant, tradeParticipants => tradeParticipants.trade,
        {cascade: true, eager: true})
    public tradeParticipants: TradeParticipant[];

    @OneToMany(type => TradeItem, tradeItem => tradeItem.trade, {cascade: true, eager: true})
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
        return equals(this, other, excludes, COMPLEX_FIELDS, MODEL_FIELDS);
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

    public constructRelations(): void {
        this.tradeParticipants = (this.tradeParticipants || []).map(part => new TradeParticipant(part));
        this.tradeItems = (this.tradeItems || []).map(item => new TradeItem(item));
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

function equals(self: Trade, other: Trade, excludes: Excludes = {},
                complexFields: Excludes = {}, modelFields = {}): boolean {
    let validParticipants: boolean;
    let validItems: boolean;

    if (excludes.tradeParticipants) {
        validParticipants = true;
    } else {
        validParticipants = compareParticipants(self.tradeParticipants, other.tradeParticipants);
    }

    if (excludes.tradeItems) {
        validItems = true;
    } else {
        validItems = compareItems(self.tradeItems, other.tradeItems);
    }

    return validParticipants && validItems;
}

function compareParticipants(selfParts: TradeParticipant[], otherParts: TradeParticipant[]) {
    logger.debug("comparing trade participants");
    const participantSort = (a: any, b: any) => (a.tradeParticipantId || 0) - (b.tradeParticipantId || 0);
    selfParts.sort(participantSort);
    otherParts.sort(participantSort);
    try {

        if (selfParts.length !== otherParts.length) {
            throw new Error("Different lengths: tradeParticipants");
        }
        // const keysNotId = Object.keys(selfParts).filter(key => key !== "tradeParticipantId");
        // let same = true;

        selfParts.forEach((part: TradeParticipant, index) => {
            const other = otherParts[index];
            if (part.participantType !== other.participantType) {
                throw new Error(`Different participant types: ${part.participantType} \n ${other.participantType}`);
            }
            if (!(new Team(part.team).equals(new Team(other.team), {players: true}))) {
                throw new Error(`Different teams: ${part.team} \n ${other.team}`);
            }
            // same = same && keysNotId.reduce((bool: boolean, prop: string) => {
            //     const res = bool && part[prop as keyof TradeParticipant] === other[prop as keyof TradeParticipant];
            //     if (!res) {
            //         throw new Error("Not matching: " + prop);
            //     }
            //     return res;
            // }, true);
            // if (!same) {
            //     throw new Error("Not matching: tradeParticipants at index: " + index);
            // }
        });
        return true;
    } catch (error) {
        throw new Error(`Not matching: tradeParticipants. Due to: ${error.message}`);
    }
}

function compareItems(selfItems: TradeItem[], otherItems: TradeItem[]) {
    logger.debug("comparing trade items");
    const itemSort = (a: any, b: any) => (a.tradeItemId || 0) - (b.tradeItemId || 0);
    selfItems.sort(itemSort);
    otherItems.sort(itemSort);

    try {
        if (selfItems.length !== otherItems.length) {
            throw new Error("Not matching (different lengths): tradeItems");
        }

        selfItems.forEach((item: TradeItem, index) => {
            const other = otherItems[index];
            if (item.tradeItemType !== other.tradeItemType) {
                throw new Error(`Not matching, tradeItemType: ${item.tradeItemType} \n ${other.tradeItemType}`);
            }

            if (!(item.sender.equals(other.sender, {players: true}))) {
                throw new Error(`Not matching, sender: ${item.sender} \n ${other.sender}`);
            }

            if (!(item.recipient.equals(other.recipient, {players: true}))) {
                throw new Error(`Not matching, recipient: ${item.recipient} \n ${other.recipient}`);
            }

            // @ts-ignore
            if (!item.entity || !other.entity || !(item.entity.equals(other.entity))) {
                throw new Error(`Not matching, entity: ${item.entity} \n ${other.entity}`);
            }
        });

        return true;
    } catch (error) {
        throw new Error(`Not matching: tradeItems. Due to: ${error.message}`);
    }
}
