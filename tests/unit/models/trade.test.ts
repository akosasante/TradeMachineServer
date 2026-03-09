import { clone } from "lodash";
import { PlayerLeagueType } from "../../../src/models/player";
import Trade, { TradeStatus } from "../../../src/models/trade";
import { DraftPickFactory } from "../../factories/DraftPickFactory";
import { PlayerFactory } from "../../factories/PlayerFactory";
import { TeamFactory } from "../../factories/TeamFactory";
import { TradeFactory } from "../../factories/TradeFactory";
import { UserFactory } from "../../factories/UserFactory";
import { Role } from "../../../src/models/user";
import logger from "../../../src/bootstrap/logger";
import { LeagueLevel } from "../../../src/models/draftPick";

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
    const testTradeObj = {
        id: testTrade.id,
        status: TradeStatus.DRAFT,
        tradeItems,
        tradeParticipants: [sender, recipient],
    };

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

    describe("owner lookup methods", () => {
        const ownerA = UserFactory.getUser("ownera@example+test.com", undefined, undefined, Role.OWNER);
        const ownerB = UserFactory.getUser("ownerb@example+test.com", undefined, undefined, Role.OWNER);
        const outsider = UserFactory.getUser("outsider@example+test.com", undefined, undefined, Role.OWNER);

        // Clone so we don't mutate the shared testTrade fixture
        const tradeWithOwners = clone(testTrade);
        tradeWithOwners.tradeParticipants = [clone(sender), clone(recipient)];
        tradeWithOwners.tradeParticipants[0].team = clone(creatorTeam);
        tradeWithOwners.tradeParticipants[0].team.owners = [ownerA];
        tradeWithOwners.tradeParticipants[1].team = clone(recipientTeam);
        tradeWithOwners.tradeParticipants[1].team.owners = [ownerB];

        const tradeNoOwners = clone(testTrade);
        tradeNoOwners.tradeParticipants = [clone(sender), clone(recipient)];
        tradeNoOwners.tradeParticipants[0].team = clone(creatorTeam);
        tradeNoOwners.tradeParticipants[0].team.owners = [];
        tradeNoOwners.tradeParticipants[1].team = clone(recipientTeam);
        tradeNoOwners.tradeParticipants[1].team.owners = [];

        describe("allOwners", () => {
            it("should return all owners flattened across all participant teams", () => {
                expect(tradeWithOwners.allOwners).toEqual([ownerA, ownerB]);
            });
            it("should return an empty array when no participant teams have owners", () => {
                expect(tradeNoOwners.allOwners).toEqual([]);
            });
            it("should return an empty array when tradeParticipants is undefined", () => {
                const noParticipants = clone(testTrade);
                noParticipants.tradeParticipants = undefined;
                expect(noParticipants.allOwners).toEqual([]);
            });
        });

        describe("includesUser", () => {
            it("should return true if the userId belongs to a creator team owner", () => {
                expect(tradeWithOwners.includesUser(ownerA.id!)).toBe(true);
            });
            it("should return true if the userId belongs to a recipient team owner", () => {
                expect(tradeWithOwners.includesUser(ownerB.id!)).toBe(true);
            });
            it("should return false if the userId does not belong to any participant team", () => {
                expect(tradeWithOwners.includesUser(outsider.id!)).toBe(false);
            });
            it("should return false when no participant teams have owners", () => {
                expect(tradeNoOwners.includesUser(ownerA.id!)).toBe(false);
            });
        });

        describe("ownerByEmail", () => {
            it("should return the owner record matching the given email", () => {
                expect(tradeWithOwners.ownerByEmail(ownerA.email)).toEqual(ownerA);
            });
            it("should find an owner in a recipient team by email", () => {
                expect(tradeWithOwners.ownerByEmail(ownerB.email)).toEqual(ownerB);
            });
            it("should return undefined when no owner matches the email", () => {
                expect(tradeWithOwners.ownerByEmail("notanowner@test.com")).toBeUndefined();
            });
            it("should return undefined when no participant teams have owners", () => {
                expect(tradeNoOwners.ownerByEmail(ownerA.email)).toBeUndefined();
            });
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
                expect(invalidTrade.isValid()).toBe(false);
            });
            it("should fail if there are no participants (empty array)", () => {
                const invalidTrade = clone(testTrade);
                invalidTrade.tradeParticipants = [];
                expect(invalidTrade.isValid()).toBe(false);
            });
            it("should fail if there are no participants (undefined)", () => {
                const invalidTrade = clone(testTrade);
                invalidTrade.tradeParticipants = undefined;
                expect(invalidTrade.isValid()).toBe(false);
            });
            it("should fail if there is no creator", () => {
                const invalidTrade = clone(testTrade);
                const secondRecipient = clone(recipient);
                secondRecipient.team = creatorTeam;
                invalidTrade.tradeParticipants = [recipient, secondRecipient];
                expect(invalidTrade.isValid()).toBe(false);
            });
            it("should fail if there is more than one creator", () => {
                const invalidTrade = clone(testTrade);
                const secondSender = clone(sender);
                secondSender.team = recipientTeam;
                invalidTrade.tradeParticipants = [sender, secondSender];
                expect(invalidTrade.isValid()).toBe(false);
            });

            it("should fail if items is undefined", () => {
                const invalidTrade = clone(testTrade);
                invalidTrade.tradeItems = undefined;
                expect(invalidTrade.isValid()).toBe(false);
            });
            it("should fail if items is empty", () => {
                const invalidTrade = clone(testTrade);
                invalidTrade.tradeItems = [];
                expect(invalidTrade.isValid()).toBe(false);
            });
            it("should return true if valid trade", () => {
                expect(testTrade.isValid()).toBe(true);
            });
        });
    });

    describe("static methods", () => {
        it("Trade.isValid/1 should return true if a valid trade by passing to instance method", () => {
            expect(Trade.isValid(testTrade)).toBe(true);
        });
        it("Trade.isValid/1 should return false if an invalid trade by passing to instance method", () => {
            const invalidTrade = clone(testTrade);
            invalidTrade.tradeParticipants = [sender];
            expect(Trade.isValid(invalidTrade)).toBe(false);
        });
    });
});
