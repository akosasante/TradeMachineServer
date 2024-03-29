import { Column, Entity, Index, OneToMany } from "typeorm";
import { BaseModel } from "./base";
import DraftPick, { LeagueLevel, MinorLeagueLevels } from "./draftPick";
import Player, { PlayerLeagueType } from "./player";
import Team from "./team";
import TradeItem from "./tradeItem";
import TradeParticipant, { TradeParticipantType } from "./tradeParticipant";
import logger from "../bootstrap/logger";
import Email from "./email";
import { inspect } from "util";

/* eslint-disable @typescript-eslint/naming-convention */
export enum TradeStatus {
    DRAFT = 1,
    REQUESTED,
    PENDING, // only a thing for more than two-person trades
    ACCEPTED,
    REJECTED,
    SUBMITTED,
}
/* eslint-enable @typescript-eslint/naming-convention */

@Entity()
@Index(["declinedById"])
export default class Trade extends BaseModel {
    @Column({ type: "enum", enum: TradeStatus, default: TradeStatus.DRAFT })
    public status?: TradeStatus;
    @Column({ nullable: true })
    public declinedReason?: string;
    @Column({ nullable: true, type: "uuid" })
    public declinedById?: string;
    @Column({ nullable: true, type: "jsonb" })
    public acceptedBy?: string[];
    @Column({ nullable: true })
    public acceptedOnDate?: Date;
    @OneToMany(_type => TradeParticipant, tradeParticipants => tradeParticipants.trade, { cascade: true, eager: true })
    public tradeParticipants?: TradeParticipant[];
    @OneToMany(_type => TradeItem, tradeItem => tradeItem.trade, { cascade: true, eager: true })
    public tradeItems?: TradeItem[];
    @OneToMany(_type => Email, email => email.trade, { cascade: ["insert"], eager: true })
    public emails?: Email[];

    constructor(props: Partial<Trade>) {
        super();
        Object.assign(this, props);
    }

    public get creator(): Team | undefined {
        const creator = (this.tradeParticipants || []).find(
            part => part.participantType === TradeParticipantType.CREATOR
        );
        return creator ? creator.team : undefined;
    }

    public get recipients(): Team[] {
        logger.debug(`this: ${inspect(this)}`);
        logger.debug(`this.tp: ${inspect(this.tradeParticipants)}`);
        return (this.tradeParticipants || [])
            .filter(part => part.participantType === TradeParticipantType.RECIPIENT)
            .map(part => part.team);
    }

    public get players(): Player[] {
        return TradeItem.filterPlayers(this.tradeItems).map(item => item.entity as Player);
    }

    public get majorPlayers(): Player[] {
        return this.players.filter(player => player.league === PlayerLeagueType.MAJOR);
    }

    public get minorPlayers(): Player[] {
        return this.players.filter(player => player.league === PlayerLeagueType.MINOR);
    }

    public get picks(): DraftPick[] {
        return TradeItem.filterPicks(this.tradeItems).map(item => item.entity as DraftPick);
    }

    public get majorPicks(): DraftPick[] {
        return this.picks.filter(pick => pick.type === LeagueLevel.MAJORS);
    }

    public get minorPicks(): DraftPick[] {
        return this.picks.filter(pick => MinorLeagueLevels.includes(pick.type));
    }

    public get highMinorPicks(): DraftPick[] {
        return this.picks.filter(pick => pick.type === LeagueLevel.HIGH);
    }

    public get lowMinorPicks(): DraftPick[] {
        return this.picks.filter(pick => pick.type === LeagueLevel.LOW);
    }

    public static isValid(trade: Partial<Trade>): boolean {
        return new Trade(trade).isValid();
    }

    public isValid(): boolean {
        const participantsAndItemsExist = !!this.tradeParticipants && !!this.tradeItems;
        if (!participantsAndItemsExist) {
            return false;
        }
        const participantsAndItemsLength = !!this.tradeItems!.length && !!this.tradeParticipants!.length;
        const recipientExists = !!this.recipients.length;
        const creatorExists = !!this.creator;
        const onlyOneCreator =
            this.tradeParticipants!.filter(part => part.participantType === TradeParticipantType.CREATOR).length === 1;
        logger.debug(
            `Result of isTradeValid? hasParticipantsAndItems=${
                participantsAndItemsExist && participantsAndItemsLength
            } | hasRecipients=${recipientExists} | hasCreator=${creatorExists && onlyOneCreator}`
        );
        return (
            participantsAndItemsExist &&
            participantsAndItemsLength &&
            recipientExists &&
            creatorExists &&
            onlyOneCreator
        );
    }
}
