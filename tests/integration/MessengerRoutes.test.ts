import { Server } from "http";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import startServer from "../../src/bootstrap/app";
import { EmailPublisher } from "../../src/email/publishers";
import { adminLoggedIn, clearDb, doLogout, makePostRequest, ownerLoggedIn, setupOwnerAndAdminUsers } from "./helpers";
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
import { getConnection } from "typeorm";

let app: Server;
let adminUser: User;
let ownerUser: User;
let tradeDao: TradeDAO;
let playerDao: PlayerDAO;
let teamDAO: TeamDAO;
const emailPublisher = EmailPublisher.getInstance();
const slackPublisher = SlackPublisher.getInstance();

async function shutdown() {
    try {
        await redisClient.disconnect();
        await emailPublisher.closeQueue();
        await slackPublisher.closeQueue();
    } catch (err) {
        logger.error(`Error while closing redis: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~MESSENGER ROUTES BEFORE ALL~~~~~~");
    app = await startServer();
    playerDao = new PlayerDAO();
    tradeDao = new TradeDAO();
    teamDAO = new TeamDAO();

    return app;
}, 5000);

afterAll(async () => {
    logger.debug("~~~~~~MESSENGER ROUTES AFTER ALL~~~~~~");
    const shutdownRedisAndQueues = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownRedisAndQueues;
});

describe("Messenger API endpoints", () => {
    const createTradeOfStatus = async (status: TradeStatus, tradeArgs: Partial<Trade> = {}) => {
        const [player] = await playerDao.createPlayers([PlayerFactory.getPlayer()]);
        let [team1, team2] = await teamDAO.createTeams([
            TeamFactory.getTeamObject("team1", 1),
            TeamFactory.getTeamObject("team2", 2),
        ]);
        team1 = await teamDAO.updateTeamOwners(team1.id!, [adminUser], []);
        team2 = await teamDAO.updateTeamOwners(team2.id!, [ownerUser], []);
        const tradeItem1 = TradeFactory.getTradedMajorPlayer(player, team1, team2);
        const tradeParticipants1 = TradeFactory.getTradeParticipants(team1, team2);

        return await tradeDao.createTrade(TradeFactory.getTrade([tradeItem1], tradeParticipants1, status, tradeArgs));
    };

    beforeEach(async () => {
        [adminUser, ownerUser] = await setupOwnerAndAdminUsers();

        // clean up the queues so the queue lengths are reset between tests
        await emailPublisher.cleanWaitQueue();
        await slackPublisher.cleanWaitQueue();

        return [adminUser, ownerUser];
    });

    afterEach(async () => {
        return await clearDb(getConnection(process.env.ORM_CONFIG));
    }, 40000);

    describe("POST /requestTrade/:id (send trade request email)", () => {
        const req =
            (id: string, status = 202) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<undefined>(agent, `/messenger/requestTrade/${id}`, undefined, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should queue a trade request email job and return 202", async () => {
            const requestedTrade = await createTradeOfStatus(TradeStatus.REQUESTED);

            const queueLengthBefore = await emailPublisher.getJobTotal();
            const { body } = await adminLoggedIn(req(requestedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toBe("trade request queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should queue a trade request job successfully if logged in as an owner", async () => {
            const requestedTrade = await createTradeOfStatus(TradeStatus.REQUESTED);

            const queueLengthBefore = await emailPublisher.getJobTotal();
            const { body } = await ownerLoggedIn(req(requestedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toBe("trade request queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        }, 2000);
        it("should return a 400 Bad Request if the trade status is not REQUESTED", async () => {
            const draftTrade = await createTradeOfStatus(TradeStatus.DRAFT);

            const queueLengthBefore = await emailPublisher.getJobTotal();
            const { body } = await adminLoggedIn(req(draftTrade.id!, 400), app);
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
        it.skip("should return a 403 Forbidden Error if a non-logged-in request is used", async () => {
            const requestedTrade = await createTradeOfStatus(TradeStatus.REQUESTED);
            const queueLengthBefore = await emailPublisher.getJobTotal();
            req(requestedTrade.id!, 403);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
    });

    describe("POST /declineTrade/:id (send trade declined email)", () => {
        const req =
            (id: string, status = 202) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<undefined>(agent, `/messenger/declineTrade/${id}`, undefined, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should queue a trade decline email job and return 202", async () => {
            const declinedTrade = await createTradeOfStatus(TradeStatus.REJECTED, {
                declinedById: ownerUser.id,
                declinedReason: "because I say so",
            });

            const queueLengthBefore = await emailPublisher.getJobTotal();
            const { body } = await adminLoggedIn(req(declinedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toBe("trade decline email queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should queue a trade declined email job successfully if logged in as an owner", async () => {
            const declinedTrade = await createTradeOfStatus(TradeStatus.REJECTED, {
                declinedById: ownerUser.id,
                declinedReason: "because I say so",
            });

            const queueLengthBefore = await emailPublisher.getJobTotal();
            const { body } = await ownerLoggedIn(req(declinedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toBe("trade decline email queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should return a 400 Bad Request if the trade status is not DECLINED", async () => {
            const draftTrade = await createTradeOfStatus(TradeStatus.DRAFT);

            const queueLengthBefore = await emailPublisher.getJobTotal();
            const { body } = await adminLoggedIn(req(draftTrade.id!, 400), app);
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

        it.skip("should return a 403 Forbidden Error if a non-logged-in request is used", async () => {
            const declinedTrade = await createTradeOfStatus(TradeStatus.REJECTED, {
                declinedById: ownerUser.id,
                declinedReason: "because I say so",
            });

            const queueLengthBefore = await emailPublisher.getJobTotal();
            await req(declinedTrade.id!, 403)(request(app));
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
    });

    describe("POST /submitTrade/:id (send trade announcement to slack)", () => {
        const req =
            (id: string, status = 202) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<undefined>(agent, `/messenger/submitTrade/${id}`, undefined, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should queue a trade announcement job and return 202", async () => {
            const submittedTrade = await createTradeOfStatus(TradeStatus.SUBMITTED);

            const queueLengthBefore = await slackPublisher.getJobTotal();
            const { body } = await adminLoggedIn(req(submittedTrade.id!), app);
            const queueLengthAfter = await slackPublisher.getJobTotal();

            expect(body.status).toBe("accepted trade announcement queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should queue a trade announcement job successfully if logged in as an owner", async () => {
            const submittedTrade = await createTradeOfStatus(TradeStatus.SUBMITTED);

            const queueLengthBefore = await slackPublisher.getJobTotal();
            const { body } = await ownerLoggedIn(req(submittedTrade.id!), app);
            const queueLengthAfter = await slackPublisher.getJobTotal();

            expect(body.status).toBe("accepted trade announcement queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should return a 400 Bad Request if the trade status is not SUBMITTED", async () => {
            const draftTrade = await createTradeOfStatus(TradeStatus.DRAFT);

            const queueLengthBefore = await slackPublisher.getJobTotal();
            const { body } = await adminLoggedIn(req(draftTrade.id!, 400), app);
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

        it.skip("should return a 403 Forbidden Error if a non-logged-in request is used", async () => {
            const submittedTrade = await createTradeOfStatus(TradeStatus.SUBMITTED);

            const queueLengthBefore = await emailPublisher.getJobTotal();
            await req(submittedTrade.id!, 403)(request(app));
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
    });

    describe("POST /acceptTrade/:id (send trade acceptance email)", () => {
        const req =
            (id: string, status = 202) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<undefined>(agent, `/messenger/acceptTrade/${id}`, undefined, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should queue a trade acceptance email job and return 202", async () => {
            const acceptedTrade = await createTradeOfStatus(TradeStatus.ACCEPTED);

            const queueLengthBefore = await emailPublisher.getJobTotal();
            const { body } = await adminLoggedIn(req(acceptedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toBe("trade acceptance email queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should queue a trade acceptance job successfully if logged in as an owner", async () => {
            const acceptedTrade = await createTradeOfStatus(TradeStatus.ACCEPTED);

            const queueLengthBefore = await emailPublisher.getJobTotal();
            const { body } = await ownerLoggedIn(req(acceptedTrade.id!), app);
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(body.status).toBe("trade acceptance email queued");
            expect(queueLengthAfter).toEqual(queueLengthBefore + 1);
        });
        it("should return a 400 Bad Request if the trade is not accepted", async () => {
            const draftTrade = await createTradeOfStatus(TradeStatus.DRAFT);

            const queueLengthBefore = await emailPublisher.getJobTotal();
            const { body } = await adminLoggedIn(req(draftTrade.id!, 400), app);
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

        it.skip("should return a 403 Forbidden Error if a non-logged-in request is used", async () => {
            const acceptedTrade = await createTradeOfStatus(TradeStatus.ACCEPTED);

            const queueLengthBefore = await emailPublisher.getJobTotal();
            await req(acceptedTrade.id!, 403)(request(app));
            const queueLengthAfter = await emailPublisher.getJobTotal();

            expect(queueLengthAfter).toEqual(queueLengthBefore);
        });
    });
});
