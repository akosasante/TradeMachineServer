import { Server } from "http";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import DraftPickDAO from "../../src/DAO/DraftPickDAO";
import PlayerDAO from "../../src/DAO/PlayerDAO";
import TeamDAO from "../../src/DAO/TeamDAO";
import Trade, { TradeStatus } from "../../src/models/trade";
import TradeParticipant, { TradeParticipantType } from "../../src/models/tradeParticipant";
import User from "../../src/models/user";
import startServer from "../../src/bootstrap/app";
import { TeamFactory } from "../factories/TeamFactory";
import { TradeFactory } from "../factories/TradeFactory";
import {
    adminLoggedIn,
    clearDb,
    DatePatternRegex,
    doLogout,
    makeDeleteRequest,
    makeGetRequest,
    makePostRequest,
    makePutRequest,
    ownerLoggedIn,
    setupOwnerAndAdminUsers,
} from "./helpers";
import { v4 as uuid } from "uuid";
import * as TradeTracker from "../../src/csv/TradeTracker";
import { getConnection } from "typeorm";
import TradeDAO from "../../src/DAO/TradeDAO";
import TradeItem from "../../src/models/tradeItem";
import { HydratedTrade } from "../../src/models/views/hydratedTrades";
import { HydratedPick } from "../../src/models/views/hydratedPicks";
import { HydratedMajorLeaguer } from "../../src/models/views/hydratedMajorLeaguers";
import { HydratedMinorLeaguer } from "../../src/models/views/hydratedMinorLeaguers";

let app: Server;
let adminUser: User;
let playerDAO: PlayerDAO;
let pickDAO: DraftPickDAO;
let teamDAO: TeamDAO;
let tradeDAO: TradeDAO;

// @ts-ignore
TradeTracker.appendNewTrade = jest.fn();

async function shutdown() {
    try {
        await redisClient.disconnect();
    } catch (err) {
        logger.error(`Error while closing redis: ${err}`);
    }
}

beforeAll(async () => {
    logger.debug("~~~~~~TRADE ROUTES BEFORE ALL~~~~~~");
    app = await startServer();

    playerDAO = new PlayerDAO();
    pickDAO = new DraftPickDAO();
    teamDAO = new TeamDAO();
    tradeDAO = new TradeDAO();

    return app;
}, 5000);

afterAll(async () => {
    logger.debug("~~~~~~TEAM ROUTES AFTER ALL~~~~~~");
    const shutdownRedis = await shutdown();
    if (app) {
        app.close(() => {
            logger.debug("CLOSED SERVER");
        });
    }
    return shutdownRedis;
});

describe("Trade API endpoints", () => {
    beforeEach(async () => {
        // Create admin and owner users in db for rest of this suite's use
        [adminUser] = await setupOwnerAndAdminUsers();
        return adminUser;
    });

    afterEach(async () => {
        return await clearDb(getConnection(process.env.ORM_CONFIG));
    });

    describe("POST /trades (create new trade)", () => {
        const expectErrorString = expect.stringMatching(/Trade is not valid/);
        const postRequest =
            (tradeObj: Partial<Trade>, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Trade>>(agent, "/trades", tradeObj, status);
        const getOneRequest = (id: string, status = 200) => makeGetRequest(request(app), `/trades/${id}`, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return a single trade object based on the object passed in", async () => {
            const testTrade = TradeFactory.getTrade();

            const { body } = await adminLoggedIn(postRequest(testTrade.parse()), app);

            const expected = {
                ...testTrade,
                tradeItems: expect.toBeArrayOfSize(testTrade.tradeItems!.length),
                tradeParticipants: expect.toBeArrayOfSize(testTrade.tradeParticipants!.length),
            };
            expect(body).toMatchObject(expected);
            expect((body as Trade).tradeItems!.map(ti => ti.id)).toIncludeSameMembers(
                testTrade.tradeItems!.map(ti => ti.id)
            );
            expect((body as Trade).tradeParticipants!.map(tp => tp.id)).toIncludeSameMembers(
                testTrade.tradeParticipants!.map(tp => tp.id)
            );
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const testTrade = TradeFactory.getTrade();
            // @ts-ignore
            await adminLoggedIn(postRequest({ ...testTrade.parse(), blah: "boop" }), app);
            const { body } = await getOneRequest(testTrade.id!);

            const expected = {
                ...testTrade,
                tradeItems: expect.toBeArrayOfSize(testTrade.tradeItems!.length),
                tradeParticipants: expect.toBeArrayOfSize(testTrade.tradeParticipants!.length),
            };
            expect(body).toMatchObject(expected);
            expect(body.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const testTrade = TradeFactory.getTrade();

            const { body } = await adminLoggedIn(
                postRequest({ tradeParticipants: testTrade.tradeParticipants }, 400),
                app
            );

            expect(body.message).toEqual(expectErrorString);
        });
        it("should return a 401 Unauthorized error if a non-logged in request is used", async () => {
            const testTrade = TradeFactory.getTrade();

            await postRequest(testTrade.parse(), 403)(request(app));
        });
    });

    describe("GET /trades (get all trades)", () => {
        const getAllRequest = (hydrated = "", status = 200) =>
            makeGetRequest(request(app), `/trades${hydrated}`, status);

        it("should return an array of all trades in the db", async () => {
            const testTrade = TradeFactory.getTrade();
            await tradeDAO.createTrade(testTrade.parse());

            const { body } = await getAllRequest();

            const expected = {
                ...testTrade,
                tradeItems: expect.toBeArrayOfSize(testTrade.tradeItems!.length),
                tradeParticipants: expect.toBeArrayOfSize(testTrade.tradeParticipants!.length),
            };
            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject(expected);
        });

        it("should return a list of hydrated trades if the hydrated param is passed in", async () => {
            const testTrade = TradeFactory.getTrade();
            await tradeDAO.createTrade(testTrade.parse());
            await teamDAO.createTeams(testTrade.picks.map((p, i) => ({ ...p.originalOwner!.parse(), espnId: i })));
            await pickDAO.createPicks(testTrade.picks.map(p => p.parse()));
            await playerDAO.createPlayers(testTrade.players.map(p => p.parse()));
            const pickIds = testTrade.picks.map(p => p.id);
            const playerIds = testTrade.majorPlayers.map(p => p.id);
            const prospectIds = testTrade.minorPlayers.map(p => p.id);

            const { body } = await getAllRequest("?hydrated=true");

            const expected: HydratedTrade = {
                tradedPicks: expect.toBeArrayOfSize(pickIds.length),
                tradedMajors: expect.toBeArrayOfSize(playerIds.length),
                tradedMinors: expect.toBeArrayOfSize(prospectIds.length),
                tradeId: testTrade.id,
                dateCreated: expect.stringMatching(DatePatternRegex),
                tradeCreator: testTrade.creator?.name,
                tradeRecipients: testTrade.recipients.map(t => t.name),
            };
            expect(body).toBeArrayOfSize(1);
            expect(body[0]).toMatchObject(expected);
            expect(body[0].tradeStatus).toEqual(testTrade.status?.toString());
            expect((body[0] as HydratedTrade).tradedPicks).toSatisfyAll((pick: HydratedPick) =>
                pickIds.includes(pick.id)
            );
            expect((body[0] as HydratedTrade).tradedMajors).toSatisfyAll((player: HydratedMajorLeaguer) =>
                playerIds.includes(player.id)
            );
            expect((body[0] as HydratedTrade).tradedMinors).toSatisfyAll((player: HydratedMinorLeaguer) =>
                prospectIds.includes(player.id)
            );
        }, 2000);
        it("should only return hydrated trades that match the statuses given", async () => {
            const _draftTrade = await tradeDAO.createTrade(TradeFactory.getTrade());
            const pendingTrade = await tradeDAO.createTrade(
                TradeFactory.getTrade(undefined, undefined, TradeStatus.PENDING)
            );
            const requestedTrade = await tradeDAO.createTrade(
                TradeFactory.getTrade(undefined, undefined, TradeStatus.REQUESTED)
            );

            const { body } = await getAllRequest(
                `?hydrated=true&statuses[]=${TradeStatus.REQUESTED}&statuses[]=${TradeStatus.PENDING}`
            );

            expect(body).toBeArrayOfSize(2);
            expect(body).toIncludeAllPartialMembers([{ tradeId: pendingTrade.id }, { tradeId: requestedTrade.id }]);
        });
    });

    describe("GET /trades/:id (get one trade)", () => {
        const getOneRequest = (id: string, hydrated = "", status = 200) =>
            makeGetRequest(request(app), `/trades/${id}${hydrated}`, status);

        it("should return a single trade for the given id", async () => {
            const testTrade = TradeFactory.getTrade();
            await tradeDAO.createTrade(testTrade.parse());

            const { body } = await getOneRequest(testTrade.id!);

            const expected = {
                ...testTrade,
                tradeItems: expect.toBeArrayOfSize(testTrade.tradeItems!.length),
                tradeParticipants: expect.toBeArrayOfSize(testTrade.tradeParticipants!.length),
            };
            expect(body).toMatchObject(expected);
        });
        it("should return a hydrated trade if the param is passed in", async () => {
            const testTrade = TradeFactory.getTrade();
            await tradeDAO.createTrade(testTrade.parse());
            await teamDAO.createTeams(testTrade.picks.map((p, i) => ({ ...p.originalOwner!.parse(), espnId: i })));
            await pickDAO.createPicks(testTrade.picks.map(p => p.parse()));
            await playerDAO.createPlayers(testTrade.players.map(p => p.parse()));
            const pickIds = testTrade.picks.map(p => p.id);
            const playerIds = testTrade.players.map(p => p.id);

            const { body } = await getOneRequest(testTrade.id!, "?hydrated=true");

            const expected = {
                ...testTrade,
                tradeItems: expect.toBeArrayOfSize(testTrade.tradeItems!.length),
                tradeParticipants: expect.toBeArrayOfSize(testTrade.tradeParticipants!.length),
            };
            expect(body).toMatchObject(expected);
            expect(body.tradeItems).toSatisfyAll(
                (ti: TradeItem) => pickIds.includes(ti.entity!.id) || playerIds.includes(ti.entity!.id)
            );
        });
        it("should throw a 404 Not Found error if there is no trade with that ID", async () => {
            const testTrade = TradeFactory.getTrade();
            await tradeDAO.createTrade(testTrade.parse());

            await getOneRequest(uuid(), "", 404);
        });
    });

    describe("PUT /trades/:id (update one trade)", () => {
        const putTradeRequest =
            (id: string, tradeObj: Partial<Trade>, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<Trade>>(agent, `/trades/${id}`, tradeObj, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return the updated trade", async () => {
            const testTrade = TradeFactory.getTrade();
            await tradeDAO.createTrade(testTrade.parse());
            const originalCreator = testTrade.tradeParticipants!.find(
                tp => tp.participantType === TradeParticipantType.CREATOR
            );
            const updatedParticipants = [originalCreator, TradeFactory.getTradeRecipient(TeamFactory.getTeam())];
            const updatedTradeParticipantIds = updatedParticipants.map(p => p!.id);
            const newItem = TradeFactory.getTradedMajorPlayer(
                undefined,
                originalCreator!.team,
                updatedParticipants[1]!.team
            );

            const { body } = await adminLoggedIn(
                putTradeRequest(testTrade.id!, {
                    ...testTrade.parse(),
                    tradeParticipants: updatedParticipants as TradeParticipant[],
                    tradeItems: [newItem],
                }),
                app
            );

            expect(body).toMatchObject({
                id: testTrade.id,
                tradeParticipants: expect.toSatisfyAll(participant =>
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    updatedTradeParticipantIds.includes(participant.id)
                ),
                tradeItems: expect.toSatisfyAll(item => newItem.id === item.id),
            });
        });
        it("should throw a 404 Not Found error if there is no trade with that ID", async () => {
            const testTrade = TradeFactory.getTrade();
            await tradeDAO.createTrade(testTrade.parse());
            const originalCreator = testTrade.tradeParticipants!.find(
                tp => tp.participantType === TradeParticipantType.CREATOR
            );
            const updatedParticipants = [originalCreator, TradeFactory.getTradeRecipient()];
            const newItem = TradeFactory.getTradedMajorPlayer(
                undefined,
                originalCreator!.team,
                updatedParticipants[1]!.team
            );

            await adminLoggedIn(
                putTradeRequest(
                    uuid(),
                    {
                        ...testTrade.parse(),
                        tradeParticipants: updatedParticipants as TradeParticipant[],
                        tradeItems: [newItem],
                    },
                    404
                ),
                app
            );
        });
        it("should throw a 401 Unauthorized error if a non-admin non-participant tries to update a trade", async () => {
            const testTrade = TradeFactory.getTrade();
            await tradeDAO.createTrade(testTrade.parse());
            const originalCreator = testTrade.tradeParticipants!.find(
                tp => tp.participantType === TradeParticipantType.CREATOR
            );
            const updatedParticipants = [originalCreator, TradeFactory.getTradeRecipient()];
            const newItem = TradeFactory.getTradedMajorPlayer(
                undefined,
                originalCreator!.team,
                updatedParticipants[1]!.team
            );

            await ownerLoggedIn(
                putTradeRequest(
                    testTrade.id!,
                    {
                        ...testTrade.parse(),
                        tradeParticipants: updatedParticipants as TradeParticipant[],
                        tradeItems: [newItem],
                    },
                    401
                ),
                app
            );
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            const testTrade = TradeFactory.getTrade();
            await tradeDAO.createTrade(testTrade.parse());
            const originalCreator = testTrade.tradeParticipants!.find(
                tp => tp.participantType === TradeParticipantType.CREATOR
            );
            const updatedParticipants = [originalCreator, TradeFactory.getTradeRecipient()];
            const newItem = TradeFactory.getTradedMajorPlayer(
                undefined,
                originalCreator!.team,
                updatedParticipants[1]!.team
            );

            await putTradeRequest(
                testTrade.id!,
                {
                    ...testTrade.parse(),
                    tradeParticipants: updatedParticipants as TradeParticipant[],
                    tradeItems: [newItem],
                },
                403
            )(request(app));
        });
    });

    describe("PUT /trades/:id/:action (accept/reject/submit a trade)", () => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        type actionBody = { declinedById: string; declinedReason: string } | undefined;
        const putTradeRequest =
            (action: string, id: string, actionObj: actionBody, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<actionBody>(agent, `/trades/${id}/${action}`, actionObj, status);

        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it(":action = accept - should return the trade with an updated status", async () => {
            const testTrade = TradeFactory.getTrade();
            testTrade.status = TradeStatus.REQUESTED;
            testTrade.recipients[0].owners = [adminUser];
            await tradeDAO.createTrade(testTrade.parse());

            const { body } = await adminLoggedIn(putTradeRequest("accept", testTrade.id!, undefined), app);

            const expected = {
                ...testTrade,
                status: TradeStatus.ACCEPTED,
                tradeItems: expect.toBeArrayOfSize(testTrade.tradeItems!.length),
                tradeParticipants: expect.toBeArrayOfSize(testTrade.tradeParticipants!.length),
            };
            expect(body).toMatchObject(expected);
        });
        it(":action = reject - should return the trade with an updated status", async () => {
            const testTrade = TradeFactory.getTrade();
            testTrade.status = TradeStatus.REQUESTED;
            await tradeDAO.createTrade(testTrade.parse());

            const { body } = await adminLoggedIn(putTradeRequest("reject", testTrade.id!, undefined), app);

            const expected = {
                ...testTrade,
                status: TradeStatus.REJECTED,
                tradeItems: expect.toBeArrayOfSize(testTrade.tradeItems!.length),
                tradeParticipants: expect.toBeArrayOfSize(testTrade.tradeParticipants!.length),
            };
            expect(body).toMatchObject(expected);
        });
        it(":action = submit - should return the trade with an updated status", async () => {
            const testTrade = TradeFactory.getTrade();
            testTrade.status = TradeStatus.ACCEPTED;
            await tradeDAO.createTrade(testTrade.parse());
            await teamDAO.createTeams(testTrade.picks.map((p, i) => ({ ...p.originalOwner!.parse(), espnId: i })));
            await pickDAO.createPicks(testTrade.picks.map(p => p.parse()));
            await playerDAO.createPlayers(testTrade.players.map(p => p.parse()));

            const { body } = await adminLoggedIn(putTradeRequest("submit", testTrade.id!, undefined), app);

            const expected = {
                ...testTrade,
                status: TradeStatus.SUBMITTED,
                tradeItems: expect.toBeArrayOfSize(testTrade.tradeItems!.length),
                tradeParticipants: expect.toBeArrayOfSize(testTrade.tradeParticipants!.length),
            };
            expect(body).toMatchObject(expected);
        });
    });

    describe("DELETE /trades/:id (delete one trade)", () => {
        const deleteTradeRequest =
            (id: string, status = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makeDeleteRequest(agent, `/trades/${id}`, status);
        afterEach(async () => {
            return await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const testTrade = TradeFactory.getTrade();
            await tradeDAO.createTrade(testTrade.parse());

            const { body } = await adminLoggedIn(deleteTradeRequest(testTrade.id!), app);
            expect(body).toEqual({ deleteCount: 1, id: testTrade.id });

            // Confirm that it was deleted from the db:
            const { body: getAllRes } = await request(app).get("/trades").expect(200);
            expect(getAllRes).toBeArrayOfSize(0);
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
