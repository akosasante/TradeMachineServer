import { Entity, OneToMany } from "typeorm";
import { BaseModel } from "./base";
import DraftPick from "./draftPick";
import Player, { LeagueLevel } from "./player";
import Team from "./team";
import TradeItem from "./tradeItem";
import TradeParticipant, { TradeParticipantType } from "./tradeParticipant";

@Entity()
export default class Trade extends BaseModel {

    public get creator(): Team|undefined {
        const creator = (this.tradeParticipants || []).find(part =>
            part.participantType === TradeParticipantType.CREATOR);
        return creator ? creator.team : undefined;
    }

    public get recipients(): Team[] {
        return (this.tradeParticipants || [])
            .filter(part => part.participantType === TradeParticipantType.RECIPIENT)
            .map(part => part.team);
    }

    public get players(): Player[] {
        return TradeItem.filterPlayers(this.tradeItems)
            .map(item => item.entity as Player);
    }

    public get majorPlayers(): Player[] {
        return this.players.filter(player => player.league === LeagueLevel.MAJOR);
    }

    public get minorPlayers(): Player[] {
        return this.players.filter(player => (player.league === LeagueLevel.LOW) || (player.league === LeagueLevel.HIGH));
    }

    public get picks(): DraftPick[] {
        return TradeItem.filterPicks(this.tradeItems)
            .map(item => item.entity as DraftPick);
    }

    @OneToMany(type => TradeParticipant, tradeParticipants => tradeParticipants.trade,
        {cascade: true, eager: true})
    public tradeParticipants?: TradeParticipant[];

    @OneToMany(type => TradeItem, tradeItem => tradeItem.trade, {cascade: true, eager: true})
    public tradeItems?: TradeItem[];

    constructor(props: Partial<Trade>) {
        super();
        Object.assign(this, props);
    }

    public isValid(): boolean {
        const participantsAndItemsExist = !!this.tradeParticipants && !!this.tradeItems;
        if (!participantsAndItemsExist) {
            return false;
        }
        const participantsAndItemsLength = !!this.tradeItems!.length && !!this.tradeParticipants!.length;
        const recipientExists = !!this.recipients.length;
        const creatorExists = !!this.creator;
        const onlyOneCreator = this.tradeParticipants!.filter(part =>
            part.participantType === TradeParticipantType.CREATOR).length === 1;
        return participantsAndItemsExist && participantsAndItemsLength &&
            recipientExists && creatorExists && onlyOneCreator;
    }
}
