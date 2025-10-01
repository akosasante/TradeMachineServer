// noinspection DuplicatedCode

import Trade, { TradeStatus } from "../../models/trade";
import TradeParticipant, { TradeParticipantType } from "../../models/tradeParticipant";
import { v4 as uuid } from "uuid";
import DraftPick, { LeagueLevel } from "../../models/draftPick";
import TradeItem, { TradeItemType } from "../../models/tradeItem";
import Player, { PlayerLeagueType } from "../../models/player";
import Email from "../../models/email";
import initializeDb from "../../bootstrap/db";
import UserDAO from "../../DAO/UserDAO";
import User from "../../models/user";
import { getConnection } from "typeorm";
import axios from "axios";
import { inspect } from "util";
import Team from "../../models/team";

interface OldPlayer {
    _id: string;
    player: string;
    rec: OldTradeOwner;
}

interface OldProspect {
    _id: string;
    prospect: string;
    rec: OldTradeOwner;
}

interface OldPick {
    _id: string;
    pick: string;
    round: number;
    type: string;
    rec: OldTradeOwner;
}

interface OldTradeItem {
    _id: string;
    picks: OldPick[];
    players: OldPlayer[];
    prospects: OldProspect[];
    sender: OldTradeOwner;
}

interface OldTradeOwner {
    _id: string;
    email: string;
    name: string;
    userId: string;
    username: string;
    password?: string;
}

interface OldTradeRecipient {
    _id: string;
    confirmed: boolean;
    recipient: OldTradeOwner;
}

interface OldTrade {
    _id: string;
    declined: { status: boolean; by?: OldTradeOwner };
    emailId: string;
    expiry: string;
    recipients: OldTradeRecipient[];
    sender: OldTradeOwner;
    trades: OldTradeItem[];
}

const devOldNameToNewOwnerId: { [key: string]: string } = {
    "Cam and Jatheesh": "476c7e97-bcdc-4b45-bcb1-dbdf62c70c62",
    "Cam MacInnis": "476c7e97-bcdc-4b45-bcb1-dbdf62c70c62",
    "Ryan Neeson": "c5cffc89-9f11-4659-ba4d-a24ae8b7bf74",
    "Flex Fox": "c5cffc89-9f11-4659-ba4d-a24ae8b7bf74",
    "Jeremiah Johnson": "b88d2b7f-59b4-4132-9274-6026825c16ba",
    "Richard Kelly-Ruetz": "b88d2b7f-59b4-4132-9274-6026825c16ba",
    "Mike Kaminski": "b88d2b7f-59b4-4132-9274-6026825c16ba",
    "Jemil Juson": "b88d2b7f-59b4-4132-9274-6026825c16ba",
    "Richard Tillo": "b88d2b7f-59b4-4132-9274-6026825c16ba",
    "Jeffrey Chow": "b88d2b7f-59b4-4132-9274-6026825c16ba",
    "Ian Stadelmann": "b88d2b7f-59b4-4132-9274-6026825c16ba",
    "Garth Newton": "b88d2b7f-59b4-4132-9274-6026825c16ba",
    "Graeme Kembel": "b88d2b7f-59b4-4132-9274-6026825c16ba",
    "Garth MacInnis": "b88d2b7f-59b4-4132-9274-6026825c16ba",
    "Nick Penner": "92e23b88-4c74-42ca-a2fa-17ec66d30ca6",
    "Cam Christie": "92e23b88-4c74-42ca-a2fa-17ec66d30ca6",
    "Ash Sebastian": "f97a1b56-c938-4995-aea0-5ba9cef092cf",
    "Chris Kennedy": "f97a1b56-c938-4995-aea0-5ba9cef092cf",
    "Jeffrey Lim": "2a9d1a16-e87e-4c30-a877-eaeac4592a22",
    "Benoit Michon": "2a9d1a16-e87e-4c30-a877-eaeac4592a22",
};
const prodOldNameToNewOwnerId: { [key: string]: string } = {
    "Cam and Jatheesh": "3034676b-d215-4839-917a-d9a2c7b49100",
    "Cam MacInnis": "3034676b-d215-4839-917a-d9a2c7b49100",
    "Ryan Neeson": "1920e12f-0912-4025-822f-88aa6066d80d",
    "Flex Fox": "11b0748c-334a-4773-813c-b694df1adf1e",
    "Jeremiah Johnson": "0b7da533-5d57-4f1d-a974-e1f6e862e038",
    "Richard Kelly-Ruetz": "0cd493a1-9b13-4030-a039-cc15e457a664",
    "Mike Kaminski": "fa03e375-f6af-40aa-8aa0-bfeb29e5ed2d",
    "Jemil Juson": "0cb28bc8-fefd-496a-ae74-502db7390cc5",
    "Richard Tillo": "160e557a-e915-45e7-8f5e-1a99f16e128b",
    "Jeffrey Chow": "8934689b-7533-4a2a-88e8-a371b326025b",
    "Ian Stadelmann": "6f7bd510-120b-4bed-a44d-2fd277ef1e28",
    "Garth Newton": "6383a741-001c-4f9a-8522-c07d81c164f8",
    "Graeme Kembel": "1d12a2e5-be8e-4035-b13b-03097200d1af",
    "Garth MacInnis": "bb84198b-aea8-4b27-8220-b99f39856c52",
    "Nick Penner": "d3b35660-478b-40e2-9a2b-53342d5c4889",
    "Cam Christie": "e82bf0c2-43d5-4476-a1ad-00d0b16ff845",
    "Ash Sebastian": "51a6131c-3efe-43f0-8c80-85936409cab6",
    "Chris Kennedy": "f6545ada-01e2-4c77-8ed2-07446b65cf35",
    "Jeffrey Lim": "00bb4a06-6e97-48eb-b1b6-599c46d67882",
    "Benoit Michon": "d4b7f04b-fa8c-4d8f-8c8d-dbcb669d132e",
};
// 855 trades, 3866 trade item, 1744 participants, 93 emails, 105 draft picks, 4452 players, 20 team, 26 user
let userDAO: UserDAO;
const schema = process.env.ORM_CONFIG === "production" ? "public" : process.env.ORM_CONFIG;

async function getOwnerFromOldOwner(owner: Pick<OldTradeOwner, "name">): Promise<User & { teamId?: string }> {
    let myMapper;
    if (process.env.ORM_CONFIG === "production" || process.env.ORM_CONFIG === "staging") {
        myMapper = prodOldNameToNewOwnerId;
    } else {
        myMapper = devOldNameToNewOwnerId;
    }
    // console.log(`looking for user with name ${owner.name} id ${myMapper[owner.name]}`)
    return (
        await getConnection(process.env.ORM_CONFIG).query(
            `-- noinspection SqlResolve

SELECT * FROM "${schema}"."user" WHERE id::text = $1 LIMIT 1`,
            [myMapper[owner.name]]
        )
    )[0] as User & { teamId?: string };
}

async function getTeamFromOldOwner(owner: Pick<OldTradeOwner, "name">): Promise<string | undefined> {
    const user = await getOwnerFromOldOwner(owner);
    // console.dir(`GOT USER: ${JSON.stringify(user)} for owner ${owner.name}`)
    // if (user) {
    //   const teams = await getConnection("development").query(`
    //       SELECT *
    //       FROM team
    //                LEFT JOIN "user" u on team.id = u."teamId"
    //       WHERE u.id = $1
    //   `, [user.id])
    //   console.dir(`GOT TEAM: ${JSON.stringify(teams)}`)
    //   return teams[0];
    // }

    return user.teamId;
}

async function getLeagueLevelFromOldPick(oldPickType: string): Promise<LeagueLevel> {
    const pickMap: { [key: string]: LeagueLevel } = {
        major: LeagueLevel.MAJORS,
        high: LeagueLevel.HIGH,
        low: LeagueLevel.LOW,
    };
    return Promise.resolve(pickMap[oldPickType]);
}

async function createTrades(oldTrades: OldTrade[]): Promise<Trade[]> {
    const res = [];
    for await (const oldTrade of oldTrades) {
        const trade = new Trade({ id: uuid() });

        if (oldTrade.declined.status) {
            trade.status = TradeStatus.REJECTED;
            if (oldTrade.declined.by) {
                trade.declinedById = (await getOwnerFromOldOwner(oldTrade.declined.by)).id;
            }
        } else {
            trade.status = TradeStatus.SUBMITTED;
            trade.acceptedOnDate = new Date(oldTrade.expiry);
        }

        const creator = new TradeParticipant({
            id: uuid(),
            participantType: TradeParticipantType.CREATOR,
            trade,
            team: (await getTeamFromOldOwner(oldTrade.sender)) as unknown as Team,
        });

        const recipients: TradeParticipant[] = [];
        for await (const recipient of oldTrade.recipients) {
            recipients.push(
                new TradeParticipant({
                    id: uuid(),
                    participantType: TradeParticipantType.RECIPIENT,
                    trade,

                    team: (await getTeamFromOldOwner(recipient.recipient)) as unknown as Team,
                })
            );
        }

        trade.tradeParticipants = [...recipients, creator];

        const tradedPicks = [];
        for await (const oldTradeItems of oldTrade.trades) {
            for await (const oldPick of oldTradeItems.picks) {
                const sender = await getTeamFromOldOwner(oldTradeItems.sender);
                const recipient = await getTeamFromOldOwner(oldPick.rec);

                // console.log(`CHECKING ${JSON.stringify(sender)} and ${JSON.stringify(recipient)}`)

                let pickId = uuid();
                const pick = new DraftPick({
                    round: oldPick.round,

                    originalOwner: (await getTeamFromOldOwner({ name: oldPick.pick })) as unknown as Team,
                    type: await getLeagueLevelFromOldPick(oldPick.type),
                    season: new Date(oldTrade.expiry).getFullYear(),
                });

                try {
                    const findPick = await getConnection(process.env.ORM_CONFIG)
                        .getRepository("DraftPick")
                        .findOne({ where: { ...pick } });
                    if (findPick) {
                        // console.log(`found pick: ${inspect(findPick)}`)
                        pickId = (findPick as DraftPick).id!;
                    } else {
                        await getConnection(process.env.ORM_CONFIG)
                            .getRepository("DraftPick")
                            .save({ ...pick, id: pickId });
                    }
                } catch (e) {
                    console.dir(e);
                }

                tradedPicks.push(
                    new TradeItem({
                        id: uuid(),
                        entity: pick,
                        tradeItemId: pickId,
                        tradeItemType: TradeItemType.PICK,
                        trade,
                        sender: sender as unknown as Team,
                        recipient: recipient as unknown as Team,
                    })
                );
            }
        }

        const tradedPlayers = [];
        for await (const oldTradeItems of oldTrade.trades) {
            for await (const oldPlayer of oldTradeItems.players) {
                const sender = await getTeamFromOldOwner(oldTradeItems.sender);
                const recipient = await getTeamFromOldOwner(oldPlayer.rec);

                let playerId = uuid();
                const player = new Player({
                    name: oldPlayer.player,
                    league: PlayerLeagueType.MAJOR,
                });
                // console.log(`CHECKING PL ${JSON.stringify(oldPlayer)} AND ${JSON.stringify(player)}`)

                const findPlayer = await getConnection(process.env.ORM_CONFIG)
                    .getRepository("Player")
                    .findOne({ where: { ...player } });
                if (findPlayer) {
                    // console.log(`found player: ${inspect(findPlayer)}`)
                    playerId = (findPlayer as Player).id!;
                } else {
                    await getConnection(process.env.ORM_CONFIG)
                        .getRepository("Player")
                        .save({ ...player, id: playerId });
                }

                tradedPlayers.push(
                    new TradeItem({
                        id: uuid(),
                        tradeItemId: playerId,
                        tradeItemType: TradeItemType.PLAYER,
                        trade,
                        sender: sender as unknown as Team,
                        recipient: recipient as unknown as Team,
                    })
                );
            }
        }

        const tradedProspects = [];
        for await (const oldTradeItems of oldTrade.trades) {
            for await (const oldProspect of oldTradeItems.prospects) {
                const sender = await getTeamFromOldOwner(oldTradeItems.sender);
                const recipient = await getTeamFromOldOwner(oldProspect.rec);

                let playerId = uuid();
                const player = new Player({
                    name: oldProspect.prospect,
                    league: PlayerLeagueType.MINOR,
                });
                // console.log(`CHECKING PR ${JSON.stringify(oldProspect)} and ${JSON.stringify(player)}`)

                const findPlayer = await getConnection(process.env.ORM_CONFIG)
                    .getRepository("Player")
                    .findOne({ where: { ...player } });
                if (findPlayer) {
                    // console.log(`found player: ${inspect(findPlayer)}`)
                    playerId = (findPlayer as Player).id!;
                } else {
                    await getConnection(process.env.ORM_CONFIG)
                        .getRepository("Player")
                        .save({ ...player, id: playerId });
                }

                tradedProspects.push(
                    new TradeItem({
                        id: uuid(),
                        tradeItemId: playerId,
                        tradeItemType: TradeItemType.PLAYER,
                        trade,

                        sender: sender as unknown as Team,

                        recipient: recipient as unknown as Team,
                    })
                );
            }
        }

        trade.tradeItems = [...tradedPicks, ...tradedPlayers, ...tradedProspects];

        const email = new Email({ messageId: oldTrade.emailId, trade, status: "unknown - old tm" });

        trade.emails = [email];

        res.push(trade);
    }
    return res;
}

async function fetchOldTrades(): Promise<{ data: { result: OldTrade[] } }> {
    const axiosInst = axios.create({
        timeout: 20000,
    });

    return await axiosInst.get("https://trades.flexfoxfantasy.com/oldApi/models/tradeHistory");
}

async function createAndInsertTrades(trades: OldTrade[]) {
    const newFFTrades = await createTrades(trades);
    console.log(inspect(newFFTrades[0]));

    return await getConnection(process.env.ORM_CONFIG).getRepository("Trade").save(newFFTrades, { chunk: 15 });
}

async function run() {
    console.log(`RUNNING SCRIPT IN ENV: ${process.env.ORM_CONFIG}`);
    await initializeDb(true);
    userDAO = new UserDAO();

    const { result: trades } = (await fetchOldTrades()).data;
    return await createAndInsertTrades(trades);
}

// const x = {
//   "declined": {
//     "status": false
//   },
//   "trades": [
//     {
//       "_id": "5e667d0bbb79764dc2aca286",
//       "sender": {
//         "_id": "5a007835003ece72d0cac80f",
//         "__v": 0,
//         "name": "Ryan Neeson",
//         "username": "Ryan Neeson",
//         "email": "ryan-neeson@hotmail.com",
//         "userId": "U0S2F7YGJ",
//         "password": "$2a$08$q23fHfS/3EOgyFxCts9AWuroDMAXT6QkwHZJ6lFy9V3KgUHGE/0Sa"
//       },
//       "players": [
//         {
//           "_id": "5e667d0bbb79764dc2aca287",
//           "player": "Madison Bumgarner ",
//           "rec": {
//             "_id": "5a007835003ece72d0cac80a",
//             "__v": 0,
//             "name": "Nick Penner",
//             "username": "nickpenner",
//             "email": "penner_nick@yahoo.ca",
//             "userId": "U0S09DSBT",
//             "password": "$2a$08$AFyNFXJcV7/3BViGAph26OSUofiKpv6WUc8kYQXEBc7FbpGjY4dUG"
//           }
//         }
//       ],
//       "picks": [
//         {
//           "_id": "5e667d0bbb79764dc2aca288",
//           "pick": "Ryan Neeson",
//           "round": 25,
//           "rec": {
//             "_id": "5a007835003ece72d0cac80a",
//             "__v": 0,
//             "name": "Nick Penner",
//             "username": "nickpenner",
//             "email": "penner_nick@yahoo.ca",
//             "userId": "U0S09DSBT",
//             "password": "$2a$08$AFyNFXJcV7/3BViGAph26OSUofiKpv6WUc8kYQXEBc7FbpGjY4dUG"
//           },
//           "type": "major"
//         }
//       ],
//       "prospects": [],
//       "__v": 0
//     },
//     {
//       "_id": "5e667d0bbb79764dc2aca289",
//       "sender": {
//         "_id": "5a007835003ece72d0cac80a",
//         "__v": 0,
//         "name": "Nick Penner",
//         "username": "nickpenner",
//         "email": "penner_nick@yahoo.ca",
//         "userId": "U0S09DSBT",
//         "password": "$2a$08$AFyNFXJcV7/3BViGAph26OSUofiKpv6WUc8kYQXEBc7FbpGjY4dUG"
//       },
//       "players": [
//         {
//           "_id": "5e667d0bbb79764dc2aca28a",
//           "player": "Mike Moustakas",
//           "rec": {
//             "_id": "5a007835003ece72d0cac80f",
//             "__v": 0,
//             "name": "Ryan Neeson",
//             "username": "Ryan Neeson",
//             "email": "ryan-neeson@hotmail.com",
//             "userId": "U0S2F7YGJ",
//             "password": "$2a$08$q23fHfS/3EOgyFxCts9AWuroDMAXT6QkwHZJ6lFy9V3KgUHGE/0Sa"
//           }
//         }
//       ],
//       "prospects": [
//         {
//           "_id": "5e667d0bbb79764dc2aca28b",
//           "prospect": "Abraham Toro",
//           "rec": {
//             "_id": "5a007835003ece72d0cac80f",
//             "__v": 0,
//             "name": "Ryan Neeson",
//             "username": "Ryan Neeson",
//             "email": "ryan-neeson@hotmail.com",
//             "userId": "U0S2F7YGJ",
//             "password": "$2a$08$q23fHfS/3EOgyFxCts9AWuroDMAXT6QkwHZJ6lFy9V3KgUHGE/0Sa"
//           }
//         }
//       ],
//       "picks": [
//         {
//           "_id": "5e667d0bbb79764dc2aca28c",
//           "pick": "Nick Penner",
//           "round": 23,
//           "rec": {
//             "_id": "5a007835003ece72d0cac80f",
//             "__v": 0,
//             "name": "Ryan Neeson",
//             "username": "Ryan Neeson",
//             "email": "ryan-neeson@hotmail.com",
//             "userId": "U0S2F7YGJ",
//             "password": "$2a$08$q23fHfS/3EOgyFxCts9AWuroDMAXT6QkwHZJ6lFy9V3KgUHGE/0Sa"
//           },
//           "type": "major"
//         }
//       ],
//       "__v": 0
//     }
//   ],
//   "expiry": "2020-03-10T17:29:47.617Z",
//   "_id": "5e667d0dbb79764dc2aca28d",
//   "emailId": "<202003091829.45455772364@smtp-relay.sendinblue.com>",
//   "sender": {
//     "_id": "5a007835003ece72d0cac80f",
//     "__v": 0,
//     "name": "Ryan Neeson",
//     "username": "Ryan Neeson",
//     "email": "ryan-neeson@hotmail.com",
//     "userId": "U0S2F7YGJ",
//     "password": "$2a$08$q23fHfS/3EOgyFxCts9AWuroDMAXT6QkwHZJ6lFy9V3KgUHGE/0Sa"
//   },
//   "recipients": [
//     {
//       "confirmed": true,
//       "_id": "5e667d0dbb79764dc2aca28e",
//       "recipient": {
//         "_id": "5a007835003ece72d0cac80a",
//         "__v": 0,
//         "name": "Nick Penner",
//         "username": "nickpenner",
//         "email": "penner_nick@yahoo.ca",
//         "userId": "U0S09DSBT",
//         "password": "$2a$08$AFyNFXJcV7/3BViGAph26OSUofiKpv6WUc8kYQXEBc7FbpGjY4dUG"
//       }
//     }
//   ],
//   "__v": 0
// }

// async function run() {
//   await initializeDb();
//   userDAO = new UserDAO()
//   teamDAO = new TeamDAO()
//   const trades: OldTrade[] = [x as unknown as OldTrade];
//   console.dir(trades);
//
//   const newTrades = await createTrades(trades);
//   console.dir(newTrades)
// }

run()
    .then(res => {
        console.log(inspect(res[0]));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(99);
    });
