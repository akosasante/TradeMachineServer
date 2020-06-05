import "jest";
import "jest-extended";
import {clone} from "lodash";
import {PlayerLeagueType} from "../../../src/models/player";
import Trade from "../../../src/models/trade";
import {DraftPickFactory} from "../../factories/DraftPickFactory";
import {PlayerFactory} from "../../factories/PlayerFactory";
import {TeamFactory} from "../../factories/TeamFactory";
import {TradeFactory} from "../../factories/TradeFactory";
import logger from "../../../src/bootstrap/logger";
import {LeagueLevel} from "../../../src/models/draftPick";

describe("Trade Class", () => {
    beforeAll(() => {
        logger.debug("~~~~~~TRADE TESTS BEGIN~~~~~~");
    });
    afterAll(() => {
        logger.debug("~~~~~~TRADE TESTS COMPLETE~~~~~~");
    });

    const [creatorTeam, recipientTeam] = TeamFactory.getTeams(2);

    const [minorPlayer, majorPlayer] = [
        PlayerFactory.getPlayer(),
        PlayerFactory.getPlayer("Pete Buttjudge", PlayerLeagueType.MAJOR),
        ];
    const [tradedMajorPlayer, tradedMinorPlayer] = [
        TradeFactory.getTradedMajorPlayer(majorPlayer, creatorTeam, recipientTeam),
        TradeFactory.getTradedMinorPlayer(minorPlayer, creatorTeam, recipientTeam),
        ];

    const [lowPick, highPick, majorPick] = [
        DraftPickFactory.getPick(),
        DraftPickFactory.getPick(1, 13, LeagueLevel.HIGH),
        DraftPickFactory.getPick(1, 14, LeagueLevel.MAJORS),
    ];
    const [tradedLowPick, tradedHighPick, tradedMajorPick] = [
        TradeFactory.getTradedPick(lowPick, recipientTeam, creatorTeam),
        TradeFactory.getTradedPick(highPick, recipientTeam, creatorTeam),
        TradeFactory.getTradedPick(majorPick, creatorTeam, recipientTeam),
    ];

    const tradeItems = [tradedMajorPlayer, tradedMinorPlayer, tradedLowPick, tradedHighPick, tradedMajorPick];
    const testTrade = TradeFactory.getTrade(tradeItems, []);

    const [sender, recipient] = [
        TradeFactory.getTradeCreator(creatorTeam, testTrade),
        TradeFactory.getTradeRecipient(recipientTeam, testTrade),
        ];
    testTrade.tradeParticipants = [sender, recipient];
    const testTradeObj = { id: testTrade.id, tradeItems, tradeParticipants: [sender, recipient] };

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
        it("picks/0 - should return all picks", () => {
            expect(testTrade.picks).toEqual([lowPick, highPick, majorPick]);
        });
        it("majorPicks/0 - should return array of only major league picks", () => {
            expect(testTrade.majorPicks).toEqual([majorPick]);
        });
        it("minorPicks/0 - should return array of all minor league picks", () => {
            expect(testTrade.minorPicks).toEqual([lowPick, highPick]);
        });
        it("highMinorPicks/0 - should return array of only high minor league picks", () => {
            expect(testTrade.highMinorPicks).toEqual([highPick]);
        });
        it("lowMinorPicks/0 - should return array of only low minor league picks", () => {
            expect(testTrade.lowMinorPicks).toEqual([lowPick]);
        });
    });

    describe("instance methods", () => {
        it("toString/0 - should return a string with the UUID", () => {
            expect(testTrade.toString()).toMatch(testTrade.id!);
            expect(testTrade.toString()).toMatch("Trade#");
        });

        it("parse/1 - should take a trade and return a POJO", () => {
            expect(testTrade).toBeInstanceOf(Trade);
            expect(testTrade.parse()).not.toBeInstanceOf(Trade);
            expect(testTrade.parse()).toEqual(testTradeObj);
            expect(testTrade.parse()).toEqual(expect.any(Object));
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
    });

    describe("static methods", () => {
        it("Trade.isValid/1 should return true if a valid trade by passing to instance method", () => {
            expect(Trade.isValid(testTrade)).toBeTrue();
        });
        it("Trade.isValid/1 should return false if an invalid trade by passing to instance method", () => {
            const invalidTrade = clone(testTrade);
            invalidTrade.tradeParticipants = [sender];
            expect(Trade.isValid(invalidTrade)).toBeFalse();
        });
    });
});
