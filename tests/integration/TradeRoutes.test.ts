import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import DraftPickDAO from "../../src/DAO/DraftPickDAO";
import PlayerDAO from "../../src/DAO/PlayerDAO";
import TeamDAO from "../../src/DAO/TeamDAO";
import { PlayerLeagueType } from "../../src/models/player";
import Trade from "../../src/models/trade";
import TradeItem from "../../src/models/tradeItem";
import TradeParticipant from "../../src/models/tradeParticipant";
import User from "../../src/models/user";
import startServer from "../../src/bootstrap/app";
import { DraftPickFactory } from "../factories/DraftPickFactory";
import { PlayerFactory } from "../factories/PlayerFactory";
import { TeamFactory } from "../factories/TeamFactory";
import { TradeFactory } from "../factories/TradeFactory";
import { adminLoggedIn, doLogout, makeDeleteRequest, makeGetRequest,
    makePostRequest, makePutRequest, ownerLoggedIn, setupOwnerAndAdminUsers, UUIDPatternRegex } from "./helpers";
import { v4 as uuid } from "uuid";
import * as TradeTracker from "../../src/csv/TradeTracker";


let app: Server;
let adminUser: User;
let ownerUser: User;
let minorPlayer = PlayerFactory.getPlayer();
let majorPlayer = PlayerFactory.getPlayer("Pete Buttjudge", PlayerLeagueType.MAJOR);
let majorPlayer2 = PlayerFactory.getPlayer("Feelda Bern", PlayerLeagueType.MAJOR);
let pick = DraftPickFactory.getPick();
delete pick.originalOwner;
let [creatorTeam, recipientTeam, recipientTeam2] = TeamFactory.getTeams(3);
// @ts-ignore
TradeTracker.appendNewTrade = jest.fn();


async function shutdown() {
    await new Promise(resolve => {
        redisClient.quit(() => {
            resolve();
        });
    });
    // redis.quit() creates a thread to close the connection.
    // We wait until all threads have been run once to ensure the connection closes.
    await new Promise(resolve => setImmediate(resolve));
}

beforeAll(async () => {
    logger.debug("~~~~~~TRADE ROUTES BEFORE ALL~~~~~~");
    app = await startServer();

    // Create admin and owner users in db for rest of this suite's use
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();

    const playerDAO = new PlayerDAO();
    const pickDAO = new DraftPickDAO();
    const teamDAO = new TeamDAO();
    const [player1, player2, player3] = await playerDAO.createPlayers([minorPlayer, majorPlayer, majorPlayer2]);
    const [draftPick] = await pickDAO.createPicks([pick]);
    const [creator, recipient1, recipient2] = await teamDAO.createTeams([creatorTeam, recipientTeam, recipientTeam2]);
    minorPlayer = await playerDAO.getPlayerById(player1.id!);
    majorPlayer = await playerDAO.getPlayerById(player2.id!);
    majorPlayer2 = await playerDAO.getPlayerById(player3.id!);
    pick = await pickDAO.getPickById(draftPick.id!);
    creatorTeam = await teamDAO.getTeamById(creator.id!);
    recipientTeam = await teamDAO.getTeamById(recipient1.id!);
    recipientTeam2 = await teamDAO.getTeamById(recipient2.id!);
});

afterAll(async () => {
    logger.debug("~~~~~~TRADE ROUTES AFTER ALL~~~~~~");
    await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
});

describe("Trade API endpoints", () => {
    let testTrade: Trade;
    let creator: TradeParticipant;
    let recipient: TradeParticipant;
    let tradedMajorPlayer: TradeItem;
    let tradedMinorPlayer: TradeItem;
    let tradedPick: TradeItem;
    let testTradeParticipantIds: (string | undefined)[];
    let testTradeItemsIds: (string | undefined)[];

    beforeAll(() => {
        creator = TradeFactory.getTradeCreator(creatorTeam);
        recipient = TradeFactory.getTradeRecipient(recipientTeam);
        tradedMajorPlayer = TradeFactory.getTradedMajorPlayer(majorPlayer, creatorTeam, recipientTeam);
        tradedMinorPlayer = TradeFactory.getTradedMinorPlayer(minorPlayer, creatorTeam, recipientTeam);
        tradedPick = TradeFactory.getTradedPick(pick, recipientTeam, creatorTeam);
        const tradeItems = [tradedMajorPlayer, tradedMinorPlayer, tradedPick];
        testTrade = TradeFactory.getTrade(tradeItems, [creator, recipient]);
        testTradeParticipantIds = testTrade.tradeParticipants!.map(p => p.id);
        testTradeItemsIds = testTrade.tradeItems!.map(i => i.id);
    });

    describe("POST /trades (create new trade)", () => {
        const expectErrorString = expect.stringMatching(/Trade is not valid/);
        const postRequest = (tradeObj: Partial<Trade>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Trade>>(agent, "/trades", tradeObj, status);
        const getOneRequest = (id: string, status: number = 200) =>
            makeGetRequest(request(app), `/trades/${id}`, status);

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single trade object based on the object passed in", async () => {
            const {body} = await adminLoggedIn(postRequest(testTrade.parse()), app);
            expect(body).toMatchObject({
                id: testTrade.id,
                tradeParticipants: expect.toSatisfyAll(participant => testTradeParticipantIds.includes(participant.id)),
                tradeItems: expect.toSatisfyAll(item => testTradeItemsIds.includes(item.id)),
            });
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            // @ts-ignore
            const {body: createBody} = await adminLoggedIn(postRequest({...testTrade.parse(), id: undefined, blah: "boop"}), app);
            const {body} = await getOneRequest(createBody.id);

            expect(body).toMatchObject({
                id: expect.stringMatching(UUIDPatternRegex),
                tradeParticipants: expect.toSatisfyAll(participant => testTradeParticipantIds.includes(participant.id)),
                tradeItems: expect.toSatisfyAll(item => testTradeItemsIds.includes(item.id)),
            });
            expect(body.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const {body} = await adminLoggedIn(postRequest({tradeParticipants: testTrade.tradeParticipants}, 400), app);
            expect(body.message).toEqual(expectErrorString);
        });
        it("should return a 401 Unauthorized error if a non-logged in request is used", async () => {
            await postRequest(testTrade.parse(), 403)(request(app));
        });
    });

    describe("GET /trades (get all trades)", () => {
        const getAllRequest = (status: number = 200) => makeGetRequest(request(app), "/trades", status);

        it("should return an array of all trades in the db", async () => {
            const {body} = await getAllRequest();
            expect(body).toBeArrayOfSize(2);
            const returnedTrade = body.find((trade: Trade) => trade.id === testTrade.id);
            expect(returnedTrade).toMatchObject({
                id: testTrade.id,
                tradeParticipants: expect.toSatisfyAll(participant => testTradeParticipantIds.includes(participant.id)),
                tradeItems: expect.toSatisfyAll(item => testTradeItemsIds.includes(item.id)),
            });
        });
    });

    describe("GET /trades/:id (get one trade)", () => {
        const getOneRequest = (id: string, status: number = 200) =>
            makeGetRequest(request(app), `/trades/${id}`, status);

        it("should return a single trade for the given id", async () => {
            const {body} = await getOneRequest(testTrade.id!);
            expect(body).toMatchObject({
                id: testTrade.id,
                tradeParticipants: expect.toSatisfyAll(participant => testTradeParticipantIds.includes(participant.id)),
                tradeItems: expect.toSatisfyAll(item => testTradeItemsIds.includes(item.id)),
            });
        });
        it("should throw a 404 Not Found error if there is no trade with that ID", async () => {
            await getOneRequest(uuid(), 404);
        });
    });

    describe("PUT /trades/:id (update one trade)", () => {
        const putTradeRequest = (id: string, tradeObj: Partial<Trade>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<Trade>>(agent, `/trades/${id}`, tradeObj, status);
        let updatedTrade: Trade;
        let updatedTradeParticipantIds: (string | undefined)[];
        let updatedTradeItemsIds: (string | undefined)[];

        beforeAll(() => {
            const recipient2 = TradeFactory.getTradeRecipient(recipientTeam2);
            const major2 = TradeFactory.getTradedMajorPlayer(majorPlayer2, creatorTeam, recipientTeam);
            const newParticipants = [creator, recipient2];
            const newItems = [major2, tradedMinorPlayer, tradedPick];
            updatedTrade = new Trade({...testTrade.parse(), tradeParticipants: newParticipants, tradeItems: newItems});
            updatedTradeParticipantIds = testTrade.tradeParticipants!.map(p => p.id);
            updatedTradeItemsIds = testTrade.tradeItems!.map(i => i.id);
        });

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated trade", async () => {
            const {body} = await adminLoggedIn(putTradeRequest(updatedTrade.id!, updatedTrade.parse()), app);
            expect(body).toMatchObject({
                id: updatedTrade.id,
                tradeParticipants: expect.toSatisfyAll(participant => updatedTradeParticipantIds.includes(participant.id)),
                tradeItems: expect.toSatisfyAll(item => updatedTradeItemsIds.includes(item.id)),
            });
        });
        it("should throw a 404 Not Found error if there is no trade with that ID", async () => {
            await adminLoggedIn(putTradeRequest(uuid(), updatedTrade.parse(), 404), app);
        });
        it("should throw a 401 Unauthorized error if a non-admin non-participant tries to update a trade", async () => {
            await ownerLoggedIn(putTradeRequest(updatedTrade.id!, updatedTrade.parse(), 401), app);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await putTradeRequest(updatedTrade.id!, updatedTrade.parse(), 403)(request(app));
        });
    });

    describe("DELETE /trades/:id (delete one trade)", () => {
        const deleteTradeRequest = (id: string, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/trades/${id}`, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const {body} = await adminLoggedIn(deleteTradeRequest(testTrade.id!), app);
            expect(body).toEqual({ deleteCount: 1, id: testTrade.id });

            // Confirm that it was deleted from the db:
            const {body: getAllRes} = await request(app).get("/trades").expect(200);
            expect(getAllRes).toBeArrayOfSize(1);
        });
        it("should throw a 404 Not Found error if there is no trade with that ID", async () => {
            await adminLoggedIn(deleteTradeRequest(uuid(), 404), app);
        });
        it("should throw a 403 Forbidden error if a non-admin tries to delete a trade", async () => {
            await ownerLoggedIn(deleteTradeRequest(uuid(), 403), app);
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await deleteTradeRequest(uuid(), 403)(request(app));
        });
    });
});
