import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import startServer from "../../src/bootstrap/app";
import { EmailPublisher } from "../../src/email/publishers";
import { adminLoggedIn, makePostRequest, ownerLoggedIn, setupOwnerAndAdminUsers } from "./helpers";
import { TradeFactory } from "../factories/TradeFactory";
import User from "../../src/models/user";
import TradeDAO from "../../src/DAO/TradeDAO";
import Trade, { TradeStatus } from "../../src/models/trade";
import PlayerDAO from "../../src/DAO/PlayerDAO";
import { PlayerFactory } from "../factories/PlayerFactory";
import { TeamFactory } from "../factories/TeamFactory";
import TeamDAO from "../../src/DAO/TeamDAO";
import { v4 as uuid } from "uuid";
import { SlackPublisher } from "../../src/slack/publishers";

let app: Server;
let adminUser: User;
let ownerUser: User;
let requestedTrade: Trade;
let declinedTrade: Trade;
let acceptedTrade: Trade;
let submittedTrade: Trade;
let draftTrade: Trade;
const emailPublisher = EmailPublisher.getInstance();
const slackPublisher = SlackPublisher.getInstance();

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
    logger.debug("~~~~~~MESSENGER ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    [adminUser, ownerUser] = await setupOwnerAndAdminUsers();

    const playerDao = new PlayerDAO();
    const tradeDao = new TradeDAO();
    const teamDAO = new TeamDAO();
    const [player] = await playerDao.createPlayers([PlayerFactory.getPlayer()]);
    let [team1, team2] = await teamDAO.createTeams([
        TeamFactory.getTeamObject( "team1", 1),
        TeamFactory.getTeamObject( "team2", 2),
    ]);
    team1 = await teamDAO.updateTeamOwners(team1.id!, [adminUser], []);
    team2 = await teamDAO.updateTeamOwners(team2.id!, [ownerUser], []);
    const tradeParticipants1 = TradeFactory.getTradeParticipants(team1, team2);
    const tradeParticipants2 = TradeFactory.getTradeParticipants(team1, team2);
    const tradeParticipants3 = TradeFactory.getTradeParticipants(team1, team2);
    const tradeParticipants4 = TradeFactory.getTradeParticipants(team1, team2);
    const tradeParticipants5 = TradeFactory.getTradeParticipants(team1, team2);
    const tradeItem1 = TradeFactory.getTradedMajorPlayer(player, team1, team2);
    const tradeItem2 = TradeFactory.getTradedMajorPlayer(player, team1, team2);
    const tradeItem3 = TradeFactory.getTradedMajorPlayer(player, team1, team2);
    const tradeItem4 = TradeFactory.getTradedMajorPlayer(player, team1, team2);
    const tradeItem5 = TradeFactory.getTradedMajorPlayer(player, team1, team2);
    requestedTrade = await tradeDao.createTrade(TradeFactory.getTrade([tradeItem1], tradeParticipants1, TradeStatus.REQUESTED));
    acceptedTrade = await tradeDao.createTrade(TradeFactory.getTrade([tradeItem2], tradeParticipants2, TradeStatus.ACCEPTED));
    draftTrade = await tradeDao.createTrade(TradeFactory.getTrade([tradeItem3], tradeParticipants3));
    declinedTrade = await tradeDao.createTrade(TradeFactory.getTrade([tradeItem4], tradeParticipants4, TradeStatus.REJECTED, {declinedById: ownerUser.id, declinedReason: "because I say so"}));
    submittedTrade = await tradeDao.createTrade(TradeFactory.getTrade([tradeItem5], tradeParticipants5, TradeStatus.SUBMITTED));
});
afterAll(async () => {
    logger.debug("~~~~~~MESSENGER ROUTES AFTER ALL~~~~~~");
    await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
});
beforeEach(async () => {
    await emailPublisher.cleanWaitQueue();
    await slackPublisher.cleanWaitQueue();
});

describe("Messenger API endpoints", () => {
    describe("POST /requestTrade/:id (send trade request email)", () => {
        const req = (id: string, status: number = 202) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<undefined>(agent, `/messenger/requestTrade/${id}`, undefined, status);

        it("should queue a trade request email job and return 202", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            const {body} = await adminLoggedIn(req(requestedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toEqual("trade request queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should queue a trade request job successfully if logged in as an owner", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            const {body} = await ownerLoggedIn(req(requestedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toEqual("trade request queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should return a 400 Bad Request if the trade is not pending", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            const {body} = await adminLoggedIn(req(draftTrade.id!, 400), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.stack).toMatch("BadRequest");
            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
        it("should return a 404 if no trade found with that id", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            await adminLoggedIn(req(uuid(), 404), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
        it("should return a 403 Forbidden Error if a non-logged-in request is used", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            await req(requestedTrade.id!, 403);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
    });

    describe("POST /declineTrade/:id (send trade declined email)", () => {
        const req = (id: string, status: number = 202) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<undefined>(agent, `/messenger/declineTrade/${id}`, undefined, status);

        it("should queue a trade decline email job and return 202", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            const {body} = await adminLoggedIn(req(declinedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toEqual("trade decline email queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should queue a trade declined email job successfully if logged in as san owner", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            const {body} = await ownerLoggedIn(req(declinedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toEqual("trade decline email queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should return a 400 Bad Request if the trade is not declined", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            const {body} = await adminLoggedIn(req(draftTrade.id!, 400), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.stack).toMatch("BadRequest");
            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
        it("should return a 404 if no trade found with that id", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            await adminLoggedIn(req(uuid(), 404), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
        it("should return a 403 Forbidden Error if a non-logge-in request is uesd", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            await req(declinedTrade.id!, 403);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
    });

    describe("POST /submitTrade/:id (send trade announcement to slack)", () => {
        const req = (id: string, status: number = 202) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<undefined>(agent, `/messenger/submitTrade/${id}`, undefined, status);

        it("should queue a trade announcement job and return 202", async () => {
            const queueLengthBefore = await slackPublisher.getJobTotal();
            const {body} = await adminLoggedIn(req(submittedTrade.id!), app);
            const queueLengthAfter = await slackPublisher.getJobTotal();

            expect(body.status).toEqual("accepted trade announcement queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should queue a trade announcement job successfully if logged in as an owner", async () => {
            const queueLengthBefore = await slackPublisher.getJobTotal();
            const {body} = await ownerLoggedIn(req(submittedTrade.id!), app);
            const queueLengthAfter = await slackPublisher.getJobTotal();

            expect(body.status).toEqual("accepted trade announcement queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should return a 400 Bad Request if the trade is not submitted", async () => {
            const queueLengthBefore = await slackPublisher.getJobTotal();
            const {body} = await adminLoggedIn(req(draftTrade.id!, 400), app);
            const queueLengthAfter = await slackPublisher.getJobTotal();

            expect(body.stack).toMatch("BadRequest");
            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
        it("should return a 404 if no trade found with that id", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            await adminLoggedIn(req(uuid(), 404), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
        it("should return a 403 Forbidden Error if a non-logged-in request is used", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            await req(acceptedTrade.id!, 403);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
    });

    describe("POST /acceptTrade/;id (send trade acceptance email)", () => {
        const req = (id: string, status: number = 202) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<undefined>(agent, `/messenger/acceptTrade/${id}`, undefined, status);

        it("should queue a trade acceptance email job and return 202", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            const {body} = await adminLoggedIn(req(acceptedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toEqual("trade acceptance email queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should queue a trade acceptance job successfully if logged in as an owner", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            const {body} = await ownerLoggedIn(req(acceptedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toEqual("trade acceptance email queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should return a 400 Bad Request if the trade is not accepted", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            const {body} = await adminLoggedIn(req(draftTrade.id!, 400), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.stack).toMatch("BadRequest");
            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
        it("should return a 404 if no trade found with that id", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            await adminLoggedIn(req(uuid(), 404), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
        it("should return a 403 Forbidden Error if a non-logged-in request is used", async () => {
            const queueLengthBefore = await emailPublisher.getJobTotal();
            await req(acceptedTrade.id!, 403);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
    });
});
