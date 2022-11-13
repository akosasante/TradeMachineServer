/* eslint-disable */
import { config as dotenvConfig } from "dotenv";
import { resolve as resolvePath } from "path";
dotenvConfig({ path: resolvePath(__dirname, "../../../.env") });
import initializeDb from "../../bootstrap/db";
import TradeParticipant, { TradeParticipantType } from "../../models/tradeParticipant";
import TeamDAO from "../../DAO/TeamDAO";
import { random, shuffle } from "lodash";
import PlayerDAO from "../../DAO/PlayerDAO";
import { PlayerLeagueType } from "../../models/player";
import TradeItem, { TradeItemType } from "../../models/tradeItem";
import { v4 as uuid } from "uuid";
import DraftPickDAO from "../../DAO/DraftPickDAO";
import Trade from "../../models/trade";
import TradeDAO from "../../DAO/TradeDAO";
import logger from "../../bootstrap/logger";
import { inspect } from "util";
import Team from "../../models/team";
import { randomUUID } from "crypto";

async function run() {
    const args = process.argv.slice(2);
    const numTeams = args[0] ? parseInt(args[0], 10) : 2;
    const numMajors = args[1] ? parseInt(args[1], 10) : 1;
    const numMinors = args[2] ? parseInt(args[2], 10) : 1;
    const numPicks = args[3] ? parseInt(args[3], 10) : 1;
    await initializeDb(process.env.DB_LOGS === "true");

    const teamDao = new TeamDAO();
    const playerDao = new PlayerDAO();
    const pickDao = new DraftPickDAO();
    const tradeDao = new TradeDAO();
    const allTeams = shuffle<Team>(await teamDao.getAllTeams());
    const allMajorPlayers = await playerDao.findPlayers({ league: PlayerLeagueType.MAJOR });
    const allMinorPlayers = await playerDao.findPlayers({ league: PlayerLeagueType.MINOR });
    const allPicks = await pickDao.getAllPicks(true);

    const creator = new TradeParticipant({
        id: uuid(),
        team: allTeams[0],
        participantType: TradeParticipantType.CREATOR,
    });
    const recipients = Array.from(Array(numTeams - 1).keys()).map(index => {
        return new TradeParticipant({
            id: uuid(),
            team: allTeams[index + 1],
            participantType: TradeParticipantType.RECIPIENT,
        });
    });

    const participants = [creator].concat(recipients);

    const tradedMajors = Array.from(Array(numMajors).keys()).map(() => {
        const sender = participants[random(0, numTeams - 1)];
        logger.debug(inspect(sender));
        logger.debug(inspect(shuffle(participants)));
        const recipient = shuffle(participants).find(p => p.id !== sender.id);
        const player = allMajorPlayers[random(0, allMajorPlayers.length - 1)];
        return new TradeItem({
            id: uuid(),
            tradeItemId: player.id,
            tradeItemType: TradeItemType.PLAYER,
            sender: sender.team,
            recipient: recipient?.team,
        });
    });

    const tradedMinors = Array.from(Array(numMinors).keys()).map(() => {
        const sender = participants[random(0, numTeams - 1)];
        const recipient = shuffle(participants).find(p => p.id !== sender.id);
        const player = allMinorPlayers[random(0, allMinorPlayers.length - 1)];
        return new TradeItem({
            id: uuid(),
            tradeItemId: player.id,
            tradeItemType: TradeItemType.PLAYER,
            sender: sender.team,
            recipient: recipient?.team,
        });
    });

    const tradedPicks = Array.from(Array(numPicks).keys()).map(() => {
        const sender = participants[random(0, numTeams - 1)];
        const recipient = shuffle(participants).find(p => p.id !== sender.id);
        const pick = allPicks[random(0, allPicks.length - 1)];
        return new TradeItem({
            id: uuid(),
            tradeItemId: pick.id,
            tradeItemType: TradeItemType.PICK,
            sender: sender.team,
            recipient: recipient?.team,
        });
    });

    const items = [...tradedMajors, ...tradedMinors, ...tradedPicks];

    const trade = new Trade({ id: randomUUID(), tradeParticipants: participants, tradeItems: items });
    return await tradeDao.createTrade(trade);
}

/**
 * Call with: DB_LOGS=<optional_boolean> ts-node src/db/seed/createRandomTrade.ts <num_teams_involved:2> <num_majors_involved:1> <num_minors_involved:1> <num_picks_involved:1>
 *     - all args are optional and have defaults
 */
run()
    .then(trade => {
        logger.info(`${trade.id}`);
        process.exit(0);
    })
    .catch(err => {
        logger.error(inspect(err));
        process.exit(999);
    });
/* eslint-enable */
