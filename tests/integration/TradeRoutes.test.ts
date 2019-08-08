import { Server } from "http";
import "jest";
import "jest-extended";
import request from "supertest";
import { redisClient } from "../../src/bootstrap/express";
import logger from "../../src/bootstrap/logger";
import DraftPickDAO from "../../src/DAO/DraftPickDAO";
import PlayerDAO from "../../src/DAO/PlayerDAO";
import TeamDAO from "../../src/DAO/TeamDAO";
import UserDAO from "../../src/DAO/UserDAO";
import DraftPick from "../../src/models/draftPick";
import Player, { LeagueLevel } from "../../src/models/player";
import Team from "../../src/models/team";
import Trade from "../../src/models/trade";
import TradeItem, { TradeItemType } from "../../src/models/tradeItem";
import TradeParticipant, { TradeParticipantType } from "../../src/models/tradeParticipant";
import User, { Role } from "../../src/models/user";
import server from "../../src/server";
import {
    doLogout,
    makeDeleteRequest,
    makeGetRequest,
    makeLoggedInRequest,
    makePostRequest,
    makePutRequest
} from "./helpers";

let app: Server;
let adminUser: User;
let ownerUser: User;
const adminUserObj = { email: "admin@example.com", password: "lol", name: "Cam", roles: [Role.ADMIN]};
const ownerUserObj = { email: "owner@example.com", password: "lol", name: "Jatheesh", roles: [Role.OWNER]};
let minorPlayer = new Player({name: "Honus Wiener", league: LeagueLevel.HIGH});
let majorPlayer = new Player({name: "Pete Buttjudge", league: LeagueLevel.MAJOR});
let majorPlayer2 = new Player({name: "Feelda Bern", league: LeagueLevel.MAJOR});
let pick = new DraftPick({round: 1, pickNumber: 12, type: LeagueLevel.LOW});
let creatorTeam = new Team({name: "Squirtle Squad", espnId: 1});
let recipientTeam = new Team({name: "Ditto Duo", espnId: 2});
let recipientTeam2 = new Team({name: "Mr Mime Mob", espnId: 3});

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
    app = await server;

    // Create admin and owner users in db for rest of this suite's use
    const userDAO = new UserDAO();
    const playerDAO = new PlayerDAO();
    const pickDAO = new DraftPickDAO();
    const teamDAO = new TeamDAO();
    adminUser = await userDAO.createUser({...adminUserObj});
    ownerUser = await userDAO.createUser({...ownerUserObj});
    await playerDAO.createPlayer(minorPlayer);
    await playerDAO.createPlayer(majorPlayer);
    await playerDAO.createPlayer(majorPlayer2);
    await pickDAO.createPick(pick);
    await teamDAO.createTeam(creatorTeam);
    await teamDAO.createTeam(recipientTeam);
    await teamDAO.createTeam(recipientTeam2);
    minorPlayer = await playerDAO.getPlayerById(1);
    majorPlayer = await playerDAO.getPlayerById(2);
    majorPlayer2 = await playerDAO.getPlayerById(3);
    pick = await pickDAO.getPickById(1);
    creatorTeam = await teamDAO.getTeamById(1);
    recipientTeam = await teamDAO.getTeamById(2);
    recipientTeam2 = await teamDAO.getTeamById(3);
});

afterAll(async () => {
    await shutdown();
    app.close(() => {
        logger.debug("CLOSED SERVER");
    });
});

describe("Trade API endpoints", () => {
    let testTrade: Trade;
    let testTradeObj = {};
    let creator: TradeParticipant;
    let recipient: TradeParticipant;
    let tradedMajorPlayer: TradeItem;
    let tradedMinorPlayer: TradeItem;
    let tradedPick: TradeItem;

    beforeAll(() => {
        creator = new TradeParticipant({tradeParticipantId: 1, participantType: TradeParticipantType.CREATOR,
            team: creatorTeam});
        recipient = new TradeParticipant({tradeParticipantId: 2, participantType: TradeParticipantType.RECIPIENT,
            team: recipientTeam});
        tradedMajorPlayer = new TradeItem({tradeItemId: 1, tradeItemType: TradeItemType.PLAYER,
            player: majorPlayer, sender: creatorTeam, recipient: recipientTeam });
        tradedMinorPlayer = new TradeItem({tradeItemId: 2, tradeItemType: TradeItemType.PLAYER,
            player: minorPlayer, sender: creatorTeam, recipient: recipientTeam });
        tradedPick = new TradeItem({tradeItemId: 3, tradeItemType: TradeItemType.PICK, pick,
            sender: recipientTeam, recipient: creatorTeam });
        const tradeItems = [tradedMajorPlayer, tradedMinorPlayer, tradedPick];
        testTradeObj = {id: 1, tradeItems, tradeParticipants: [creator, recipient]};
        testTrade = new Trade(testTradeObj);
    });

    const adminLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), adminUserObj.email, adminUserObj.password, requestFn);
    const ownerLoggedIn = (requestFn: (ag: request.SuperTest<request.Test>) => any) =>
        makeLoggedInRequest(request.agent(app), ownerUserObj.email, ownerUserObj.password, requestFn);

    describe("POST /trades (create new trade)", () => {
        const expectConstructorErrorString = expect.stringMatching(/Trade is not valid/);
        const postRequest = (tradeObj: Partial<Trade>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePostRequest<Partial<Trade>>(agent, "/trades", tradeObj, status);

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a single trade object based on the object passed in", async () => {
            const res = await adminLoggedIn(postRequest(testTradeObj));
            const resTrade = new Trade(res.body);
            resTrade.constructRelations();
            expect(testTrade.equals(resTrade)).toBeTrue();
        });
        it("should ignore any invalid properties from the object passed in", async () => {
            const newCreator = new TradeParticipant({...creator, tradeParticipantId: undefined});
            const newRecipient = new TradeParticipant({...recipient, tradeParticipantId: undefined});
            const newPick = new TradeItem({ ...tradedPick, tradeItemId: undefined });
            const testTrade2 = new Trade({tradeItems: [newPick], tradeParticipants: [newCreator, newRecipient]});

            const res = await adminLoggedIn(postRequest(testTrade2.parse()));
            const resTrade = new Trade(res.body);
            resTrade.constructRelations();
            expect(testTrade2.equals(resTrade)).toBeTrue();
            expect(res.body.blah).toBeUndefined();
        });
        it("should return a 400 Bad Request error if missing a required property", async () => {
            const tradeObj = { tradeParticipants: [] };
            const res = await adminLoggedIn(postRequest(tradeObj, 400));
            const resTrade = new Trade(res.body);
            resTrade.constructRelations();
            expect(res.body.stack).toEqual(expectConstructorErrorString);
        });
        it("should return a 403 Forbidden error if a non-admin tries to create a trade", async () => {
            await ownerLoggedIn(postRequest(testTradeObj, 403));
        });
        it("should return a 403 Forbidden error if a non-logged in request is used", async () => {
            await postRequest(testTradeObj, 403)(request(app));
        });
    });

    describe("GET /trades (get all trades)", () => {
        const getAllRequest = (status: number = 200) => makeGetRequest(request(app), "/trades", status);

        it("should return an array of all trades in the db", async () => {
            const res = await getAllRequest();
            expect(res.body).toBeArrayOfSize(2);
            const resTrade = new Trade(res.body[0]);
            resTrade.constructRelations();
            expect(testTrade.equals(resTrade)).toBeTrue();
        });
    });

    describe("GET /trades/:id (get one trade)", () => {
        const getOneRequest = (id: number, status: number = 200) =>
            makeGetRequest(request(app), `/trades/${id}`, status);

        it("should return a single trade for the given id", async () => {
            const res = await getOneRequest(1);
            expect(res.body).toBeObject();
            const resTrade = new Trade(res.body);
            resTrade.constructRelations();
            expect(testTrade.equals(resTrade)).toBeTrue();
            expect(res.body.id).toEqual(1);
        });
        it("should throw a 404 Not Found error if there is no trade with that ID", async () => {
            await getOneRequest(999, 404);
        });
    });

    describe("PUT /trades/:id (update one trade)", () => {
        const putTradeRequest = (id: number, tradeObj: Partial<Trade>, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) =>
                makePutRequest<Partial<Trade>>(agent, `/trades/${id}`, tradeObj, status);
        let updatedTradeObj: Partial<Trade> = {};
        let updatedTrade: Trade;

        beforeAll(() => {
            const recipient2 = new TradeParticipant({ tradeParticipantId: 3,
                participantType: TradeParticipantType.RECIPIENT, team: recipientTeam2});
            const major2 = new TradeItem({tradeItemType: TradeItemType.PLAYER,
                player: majorPlayer2, sender: creatorTeam, recipient: recipientTeam });
            const newParticipants = [creator, recipient2];
            const newItems = [major2, tradedMinorPlayer, tradedPick];
            updatedTradeObj = {...testTradeObj, tradeParticipants: newParticipants, tradeItems: newItems};
            updatedTrade = new Trade(updatedTradeObj);
        });

        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return the updated trade", async () => {
            const res = await adminLoggedIn(putTradeRequest(updatedTradeObj.id!, updatedTradeObj));
            const updatedTradeRes = new Trade(res.body);
            updatedTradeRes.constructRelations();

            // @ts-ignore
            updatedTrade.tradeItems[0].tradeItemId = 4;
            expect(updatedTrade.equals(updatedTradeRes)).toBeTrue();

            // Confirm db was actually updated:
            const getOneTrade = await request(app).get(`/trades/${updatedTradeObj.id}`).expect(200);
            const getOneTradeRes = new Trade(getOneTrade.body);
            getOneTradeRes.constructRelations();
            expect(updatedTrade.equals(getOneTradeRes)).toBeTrue();
        });
        it("should throw a 404 Not Found error if there is no trade with that ID", async () => {
            await adminLoggedIn(putTradeRequest(999, updatedTradeObj, 404));
        });
        it("should throw a 403 Forbidden error if a non-admin tries to update a trade", async () => {
            await ownerLoggedIn(putTradeRequest(1, updatedTradeObj, 403));
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await putTradeRequest(1, updatedTradeObj, 403)(request(app));
        });
    });

    describe("DELETE /trades/:id (delete one trade)", () => {
        const deleteTradeRequest = (id: number, status: number = 200) =>
            (agent: request.SuperTest<request.Test>) => makeDeleteRequest(agent, `/trades/${id}`, status);
        afterEach(async () => {
            await doLogout(request.agent(app));
        });

        it("should return a delete result if successful", async () => {
            const res = await adminLoggedIn(deleteTradeRequest(1));
            expect(res.body).toEqual({ deleteCount: 1, id: 1 });

            // Confirm that it was deleted from the db:
            const getAll = await request(app).get("/trades").expect(200);
            const getAllRes = new Trade(getAll.body[0]);
            getAllRes.constructRelations();
            expect(getAll.body).toBeArrayOfSize(1);
            expect(getAllRes.id).toEqual(2);
        });
        it("should throw a 404 Not Found error if there is no trade with that ID", async () => {
            await adminLoggedIn(deleteTradeRequest(1, 404));
        });
        it("should throw a 403 Forbidden error if a non-admin tries to delete a trade", async () => {
            await ownerLoggedIn(deleteTradeRequest(2, 403));
        });
        it("should throw a 403 Forbidden error if a non-logged-in request is used", async () => {
            await deleteTradeRequest(2, 403)(request(app));
        });
    });
});
