import logger from "../../../src/bootstrap/logger";
import TradeFormatter from "../../../src/slack/tradeFormatter";
import { TradeFactory } from "../../factories/TradeFactory";
import { UserFactory } from "../../factories/UserFactory";
import TradeItem from "../../../src/models/tradeItem";
import DraftPickDAO from "../../../src/DAO/DraftPickDAO";
import { TeamFactory } from "../../factories/TeamFactory";
import PlayerDAO from "../../../src/DAO/PlayerDAO";
import { LeagueLevel } from "../../../src/models/draftPick";

beforeAll(() => {
    logger.debug("~~~~~~SLACK TRADE FORMATTER TESTS BEGIN~~~~~~");
});
afterAll(() => {
    logger.debug("~~~~~~SLACK TRADE FORMATTER TESTS COMPLETE~~~~~~");
});

const trade = TradeFactory.getTrade();
trade.creator!.owners = [UserFactory.getUser(undefined, undefined, undefined, undefined, {slackUsername: "U12345"})];
trade.recipients[0].owners = [UserFactory.getUser(undefined, undefined, undefined, undefined, {slackUsername: "U98765"})];
const tradedPick = trade.picks[0];
tradedPick.originalOwner = TeamFactory.getTeam();
const tradedMajorPlayer = trade.majorPlayers[0];
const tradedMinorPlayer = trade.minorPlayers[0];
trade.tradeItems?.forEach(it => {
    it.recipient = trade.tradeItems![0].sender;
});
const mockGetPlayerById = jest.fn();

const mockPickDao = {
    getPickById: jest.fn().mockResolvedValue(tradedPick),
} as unknown as DraftPickDAO;
const mockPlayerDao = {
    getPlayerById: mockGetPlayerById,
} as unknown as PlayerDAO;

afterEach(() => {
    mockGetPlayerById.mockClear();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return
    [mockPickDao, mockPlayerDao].forEach(mockedThing => Object.values(mockedThing).forEach(mockFn => mockFn.mockClear()));
});


describe("Trade Formatter methods", () => {
    it("getTitleText/0 should return the expected title text", () => {
        expect(TradeFormatter.getTitleText()).toEqual(":loud_sound:  *A Trade Has Been Submitted*  :loud_sound:");
    });
    it("getLinkText/0 should return the expected link text", () => {
        expect(TradeFormatter.getLinkText()).toEqual(":link: Submit trades on the <https://trades.flexfoxfantasy.com|FlexFoxFantasy TradeMachine> by 11:00PM ET");
    });
    it("getPickTypeString/1 should return the appropriate pick type text", () => {
        expect(TradeFormatter.getPickTypeString(LeagueLevel.MAJORS)).toEqual("Major League");
        expect(TradeFormatter.getPickTypeString(LeagueLevel.HIGH)).toEqual("High Minors");
        expect(TradeFormatter.getPickTypeString(LeagueLevel.LOW)).toEqual("Low Minors");
    });
    it("getNotificationText/1 should format the team names involved in the trade", () => {
        const text = TradeFormatter.getNotificationText(trade);
        expect(text).toMatch("Trade submitted between");
        expect(text).toMatch(`${trade.creator!.name} & ${trade.recipients[0]!.name}`);
    });
    it("getSubtitleText/1 should format the subtitle with the correct date and slack tags", () => {
        const text = TradeFormatter.getSubtitleText(trade);
        expect(text).toMatch("Trade requested by");
        expect(text).toMatch("Trading with: ");
        expect(text).toMatch(`<@${trade.creator!.owners![0].slackUsername}>`);
        expect(text).toMatch(`<@${trade.recipients[0].owners![0].slackUsername}>`);
        expect(text).toMatch("Trading with: ");
    });
    it("prepPickText/3 should format a bullet point list of picks", async () => {
        const text = await TradeFormatter.prepPickText(true, TradeItem.filterPicks(trade.tradeItems), mockPickDao);
        expect(text).toMatch("'s");
        // expect(text).toMatch("round pick");
        expect(text).toMatch(tradedPick.originalOwner!.name);
        expect(text).toMatch(tradedPick.season.toString());
        expect(text).toMatch(tradedPick.round.toString());
        expect(text).not.toMatch("from");
    });
    it("prepPickText/3 should include the sender if more than 2-team trade", async () => {
        const text = await TradeFormatter.prepPickText(false, TradeItem.filterPicks(trade.tradeItems), mockPickDao);
        // expect(text).toMatch("round pick");
        expect(text).toMatch(tradedPick.originalOwner!.name);
        expect(text).toMatch(tradedPick.season.toString());
        expect(text).toMatch(tradedPick.round.toString());
        expect(text).toMatch("from");
    });
    it("prepPlayerText/3 should format a bullet point list of players", async () => {
        mockGetPlayerById
            .mockReturnValueOnce(tradedMinorPlayer)
            .mockReturnValueOnce(tradedMajorPlayer);
        const text = await TradeFormatter.prepPlayerText(true, TradeItem.filterPlayers(trade.tradeItems), mockPlayerDao);
        expect(text).toMatch(tradedMajorPlayer.name);
        expect(text).toMatch(tradedMinorPlayer.name);
        expect(text).toMatch("Majors");
        expect(text).not.toMatch("from");
    });
    it("prepPlayerText/3 should include the sender if more than 2-team trade", async () => {
        mockGetPlayerById
            .mockResolvedValueOnce(tradedMajorPlayer)
            .mockResolvedValueOnce(tradedMinorPlayer);
        const text = await TradeFormatter.prepPlayerText(false, TradeItem.filterPlayers(trade.tradeItems), mockPlayerDao);
        expect(text).toMatch(tradedMajorPlayer.name);
        expect(text).toMatch(tradedMinorPlayer.name);
        expect(text).toMatch("Majors");
        expect(text).toMatch("from");
    });
    it("getTradeTextForParticipant/3 - should render the items received by trade participant and format correctly", async () => {
        mockGetPlayerById
            .mockResolvedValueOnce(tradedMajorPlayer)
            .mockResolvedValueOnce(tradedMinorPlayer);
        const text = await TradeFormatter.getTradeTextForParticipant(true, trade, trade.tradeParticipants![0], {
            playerDao: mockPlayerDao,
            pickDao: mockPickDao,
        });
        expect(text).toMatch("receives:*");
        expect(text).toMatch(trade.tradeParticipants![0].team.name);
        expect(text).toMatch("Majors");
        expect(text).toMatch("Minors");
        // expect(text).toMatch("round pick");
        expect(text).not.toMatch("from");
    });
});
