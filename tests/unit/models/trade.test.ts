import "jest";
import "jest-extended";
import { clone } from "lodash";
import { LeagueLevel } from "../../../src/models/player";
import Team from "../../../src/models/team";
import Trade from "../../../src/models/trade";
import TradeItem, { TradeItemType } from "../../../src/models/tradeItem";
import TradeParticipant, { TradeParticipantType } from "../../../src/models/tradeParticipant";
import { DraftPickFactory } from "../../factories/DraftPickFactory";
import { PlayerFactory } from "../../factories/PlayerFactory";
import { TeamFactory } from "../../factories/TeamFactory";
import { TradeFactory } from "../../factories/TradeFactory";

describe("Trade Class", () => {
    const minorPlayer = PlayerFactory.getPlayer(undefined, LeagueLevel.HIGH);
    const majorPlayer = PlayerFactory.getPlayer("Pete Buttjudge", LeagueLevel.MAJOR);
    const pick = DraftPickFactory.getPick();
    const [creatorTeam, recipientTeam] = TeamFactory.getTeams(2);
    const sender = TradeFactory.getTradeCreator(creatorTeam);
    const recipient = TradeFactory.getTradeRecipient(recipientTeam);
    const tradedMajorPlayer = TradeFactory.getTradedMajorPlayer(majorPlayer, creatorTeam, recipientTeam);
    const tradedMinorPlayer = TradeFactory.getTradedMinorPlayer(minorPlayer, creatorTeam, recipientTeam);
    const tradedPick = TradeFactory.getTradedPick(pick, recipientTeam, creatorTeam);
    const tradeItems = [tradedMajorPlayer, tradedMinorPlayer, tradedPick];
    const testTrade = new Trade({id: 1, tradeItems, tradeParticipants: [sender, recipient]});

    describe("constructor", () => {
        it("should construct the obj as expected", () => {
            expect(testTrade.tradeParticipants).toEqual([sender, recipient]);
            expect(testTrade.tradeItems).toEqual(tradeItems);
        });
    });

    describe("getters", () => {
        it("creator/0 - should return the creator of the trade", () => {
            expect(testTrade.creator).toEqual(creatorTeam);
        });
        it("recipients/0 - should return the recipients as an array", () => {
            expect(testTrade.recipients).toEqual([recipientTeam]);
        });
        it("players/0 - should return major and minor league players", () => {
            expect(testTrade.players).toEqual([majorPlayer, minorPlayer]);
        });
        it("majorPlayers/0 - should return only major league players", () => {
            expect(testTrade.majorPlayers).toEqual([majorPlayer]);
        });
        it("minorPlayers/0 - should return only minor league players", () => {
            expect(testTrade.minorPlayers).toEqual([minorPlayer]);
        });
        it("picks/0 - should return picks", () => {
            expect(testTrade.picks).toEqual([pick]);
        });
    });

    describe("instance methods", () => {
        it("toString/0", () => {
            expect(testTrade.toString()).toMatch(/Trade#\d+ with \d+ trade entities/);
        });

        describe("isValid/0", () => {
            // Next four tests assert that there must be >= 2 participants, and exactly one creator
            it("should fail if there is only one participant", () => {
                const invalidTrade = clone(testTrade);
                invalidTrade.tradeParticipants = [sender];
                expect(invalidTrade.isValid()).toBeFalse();

            });
            it("should fail if there are no participants (empty array)", () => {
                const invalidTrade = clone(testTrade);
                invalidTrade.tradeParticipants = [];
                expect(invalidTrade.isValid()).toBeFalse();
            });
            it("should fail if there are no participants (undefined)", () => {
                const invalidTrade = clone(testTrade);
                // @ts-ignore
                invalidTrade.tradeParticipants = undefined;
                expect(invalidTrade.isValid()).toBeFalse();

            });
            it("should fail if there is no creator", () => {
                const invalidTrade = clone(testTrade);
                const secondRecipient = clone(recipient);
                secondRecipient.team = creatorTeam;
                invalidTrade.tradeParticipants = [recipient, secondRecipient];
                expect(invalidTrade.isValid()).toBeFalse();

            });
            it("should fail if there is more than one creator", () => {
                const invalidTrade = clone(testTrade);
                const secondSender = clone(sender);
                secondSender.team = recipientTeam;
                invalidTrade.tradeParticipants = [sender, secondSender];
                expect(invalidTrade.isValid()).toBeFalse();
            });

            it("should fail if items is undefined", () => {
                const invalidTrade = clone(testTrade);
                // @ts-ignore
                invalidTrade.tradeItems = undefined;
                expect(invalidTrade.isValid()).toBeFalse();
            });
            it("should fail if items is empty", () => {
                const invalidTrade = clone(testTrade);
                invalidTrade.tradeItems = [];
                expect(invalidTrade.isValid()).toBeFalse();
            });
            it("should return true if valid trade", () => {
                expect(testTrade.isValid()).toBeTrue();
            });
        });

        describe("constructRelations/0", () => {
            // @ts-ignore
            const trade = new Trade({
                tradeItems: [
                    {tradeItemType: TradeItemType.PLAYER, player: majorPlayer, sender: creatorTeam,
                        recipient: recipientTeam },
                    {tradeItemType: TradeItemType.PICK, pick, sender: recipientTeam, recipient: creatorTeam },
                    ],
                tradeParticipants: [
                    {participantType: TradeParticipantType.RECIPIENT, team: recipientTeam},
                    {participantType: TradeParticipantType.CREATOR, team: creatorTeam},
                ],
            });
            expect(trade.tradeItems[0]).not.toBeInstanceOf(TradeItem);
            expect(trade.tradeParticipants[0]).not.toBeInstanceOf(TradeParticipant);
            trade.constructRelations();
            expect(trade.tradeItems[0]).toBeInstanceOf(TradeItem);
            expect(trade.tradeParticipants[0]).toBeInstanceOf(TradeParticipant);
        });

        describe("equals/2", () => {
            const copyTrade = clone(testTrade);

            const diffParticipants = clone(testTrade);
            const diffRecipient = new TradeParticipant({
                participantType: TradeParticipantType.RECIPIENT,
                team: new Team({name: "Mr. Mime Mob", espnId: 3})});
            diffParticipants.tradeParticipants = [sender, diffRecipient];

            const diffItems = clone(testTrade);
            diffItems.tradeItems = [tradedMinorPlayer];

            it("should return true if the two instances are identical. Excludes = default", () => {
                expect(testTrade.equals(copyTrade)).toBeTrue();
            });
            it("should return true if the two instances are identical considering the excludes", () => {
                expect(testTrade.equals(diffParticipants, {tradeParticipants: true})).toBeTrue();
            });
            it("should throw a useful error if something doesn't match (complex props)", () => {
                expect(() => testTrade.equals(diffParticipants))
                    .toThrowWithMessage(Error, /Not matching: tradeParticipants/);
                expect(() => testTrade.equals(diffItems)).toThrowWithMessage(Error, /Not matching: tradeItems/);
            });
        });

        it("mapByTradeItemType/0", () => {
            const expectedMap = {
                tradeId: testTrade.id,
                majorLeaguePlayers: [tradedMajorPlayer],
                minorLeaguePlayers: [tradedMinorPlayer],
                picks: [tradedPick],
            };
            expect(testTrade.mapByTradeItemType()).toEqual(expectedMap);
        });

        it("mapBySender/0", () => {
            const expectedMap = {
                tradeId: testTrade.id,
                [creatorTeam.name]: [tradedMajorPlayer, tradedMinorPlayer],
                [recipientTeam.name]: [tradedPick],
            };
            expect(testTrade.mapBySender()).toEqual(expectedMap);
        });

        it("mapByRecipient/0", () => {
            const expectedMap = {
                tradeId: testTrade.id,
                [creatorTeam.name]: [tradedPick],
                [recipientTeam.name]: [tradedMajorPlayer, tradedMinorPlayer],
            };
            expect(testTrade.mapByRecipient()).toEqual(expectedMap);
        });
    });
});
