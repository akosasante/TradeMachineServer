import initializeDb from "../bootstrap/db";
import { getConnection } from "typeorm";
import { uniqBy } from "lodash";
import { getCsvFromUrl } from "../db/seed/helpers/csvHelper";
import { processMinorLeagueCsv } from "../csv/PlayerParser";
import PlayerDAO from "../DAO/PlayerDAO";
import TeamDAO from "../DAO/TeamDAO";
import Player from "../models/player";

// tslint:disable:no-console

async function run() {
    const args = process.argv.slice(2);

    await initializeDb(true);
    const dbConn = getConnection(process.env.NODE_ENV).getRepository("Player");
    const players = await dbConn.query(`WITH dupes AS (
    SELECT player.name, COUNT(*) FROM player
    GROUP BY player.name
    HAVING COUNT(*) > 1
    ORDER BY player.name
    )
SELECT * FROM player WHERE name in (SELECT dupes.name FROM dupes) ORDER by name`);

    console.log(`found ${players.length} dupes`);

    const teamDAO = new TeamDAO();
    const allTeams = await teamDAO.getAllTeams();
    const playerDAO = new PlayerDAO();
    const MINOR_LEAGUE_SHEETS_URL = args[0] || "https://docs.google.com/spreadsheets/d/e/2PACX-1vRRwHMjBxlsPTO9XPsiwuTroHi93Fijfx8bofQhnlrivopm2F898hqwzyyox5hyKePL3YacBFtbphK_/pub?gid=555552461&single=true&output=csv";
    const tempPath = "/tmp/trade_machine_2_csvs/";
    const MinorLeagueCsv = await getCsvFromUrl(MINOR_LEAGUE_SHEETS_URL, tempPath, `downloaded minor league players csv - ${Date.now()}.csv`);
    const sheetPlayers = await processMinorLeagueCsv(MinorLeagueCsv, allTeams, playerDAO, "return");

    const uniqueNamedPlayers = uniqBy(players, "name");

    function hasAMinorLeaguer(playerList: any[]) {
        return playerList.some(p => p.league === "2");
    }

    function hasAMajorLeaguer(playerList: any[]) {
        return playerList.some(p => p.league === "1");
    }

    function existsInCurrentMinorsSheet(player: Partial<Player>): boolean {
        return sheetPlayers.some(p => p.name === player.name);
    }

    function getMetaFromSheet(player: Partial<Player>) {
        const pl = sheetPlayers.find(p => p.name === player.name);
        return { owner: pl?.leagueTeam?.id, meta: pl?.meta };
    }

    for (const pl of uniqueNamedPlayers) {
        // @ts-ignore
        const {name} = pl;
        // @ts-ignore
        const dupePlayers = players.filter(p => p.name === name);
        console.log("dupe players: ", dupePlayers.length);
        if (hasAMinorLeaguer(dupePlayers) && hasAMajorLeaguer(dupePlayers)) {
            // @ts-ignore
            const minorLeaguer = dupePlayers.find(p => p.league === "2");
            // @ts-ignore
            const majorLeaguer = dupePlayers.find(p => p.league === "1");
            if (!majorLeaguer.leagueTeamId && !!minorLeaguer.leagueTeamId) {
                // We have a major leaguer that's not owned and a minor leaguer that _is_ owned. Let's delete the major leaguer and give the minor leaguer it's playerDataId
                const playerDataIdToCopyOver = majorLeaguer.playerDataId;
                console.log("deleting major league player because it doesnt have a team and the dupe minor leaguer does", majorLeaguer);
                await dbConn.query(`DELETE FROM player WHERE id = '${majorLeaguer.id}'`);
                console.log("updating minor league player", minorLeaguer, playerDataIdToCopyOver);
                await dbConn.query(`UPDATE player SET "playerDataId" = ${playerDataIdToCopyOver} WHERE id = '${minorLeaguer.id}'`);
            } else if (!!majorLeaguer.leagueTeamId && !!minorLeaguer.leagueTeamId && minorLeaguer.leagueTeamId === majorLeaguer.leagueTeamId) {
                if (!existsInCurrentMinorsSheet(minorLeaguer)) {
                    console.log("deleting minor league player because it duplicates a major league player with a team", minorLeaguer);
                    await dbConn.query(`DELETE FROM player WHERE id = '${minorLeaguer.id}'`);
                }
            } else if (!!majorLeaguer.leagueTeamId && !minorLeaguer.leagueTeamId) {
                if (existsInCurrentMinorsSheet(minorLeaguer)) {
                    const playerDataIdToCopyOver = majorLeaguer.playerDataId;
                    const {owner: ownerId, meta} = getMetaFromSheet(minorLeaguer);
                    console.log("deleting major league player because it duplicates a minor leaguer that exists in the sheets", majorLeaguer);
                    await dbConn.query(`DELETE FROM player WHERE id = '${majorLeaguer.id}'`);
                    await dbConn.query(`UPDATE player SET "playerDataId" = ${playerDataIdToCopyOver}, "leagueTeamId" = '${ownerId}', "meta" = '${JSON.stringify(meta)}'::json  WHERE id = '${minorLeaguer.id}'`);
                }
            }
        }
    }

    console.log(`found ${uniqueNamedPlayers.length} unique names`);


    return true;
}

run()
    .then(res => { console.log(res); process.exit(0); })
    .catch(err => { console.error(err); process.exit(99); });
