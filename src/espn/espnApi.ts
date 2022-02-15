import axios, { AxiosInstance } from "axios";
import Player from "../models/player";
import { uniqWith } from "lodash";
import logger from "../bootstrap/logger";
import PlayerDAO from "../DAO/PlayerDAO";
import TeamDAO from "../DAO/TeamDAO";
import { cleanupQuery } from "../api/helpers/ApiHelpers";

export interface EspnLeagueMember {
    id: string;
    isLeagueManager: boolean;
    displayName: string;
}

interface EspnRecord {
    gamesBack: number;
    losses: number;
    percentage: number;
    pointsAgainst: number;
    pointsFor: number;
    streakLength: number;
    streakType: "WIN" | "LOSS" | string;
    ties: number;
    wins: number;
}

interface EspnRecordObj {
    away: EspnRecord;
    home: EspnRecord;
    division: EspnRecord;
    overall: EspnRecord;
}

export interface EspnProTeam {
    id: number;
    abbrev: string;
    location: string;
    name: string;
    byeWeek: number;
    universeId?: number;
}

export interface EspnFantasyTeam {
    id: number;
    abbrev?: string;
    location?: string;
    nickname?: string;
    owners?: string[];
    divisionId?: number;
    isActive?: boolean;
    logo?: string;
    record?: EspnRecordObj;
    playoffSeed?: number;
    rankFinal?: number;
    rankCalculatedFinal?: number;
    points?: number;
    pointsAdjusted?: number;
    pointsDelta?: number;
}

interface EspnPlayerInfo {
    id: number;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    proTeamId?: number;
    eligibleSlots?: number[];
    defaultPositionId?: number;
    ownership?: object;
    jersey?: string;
    injured?: boolean;
    injuryStatus?: string;
    active?: boolean;
}

interface EspnPlayerPoolEntry {
    player: EspnPlayerInfo;
    keeperValue: number;
    keeperValueFuture: number;
    onTeamId: number;
    id: number;
    appliedStatTotal: number;
    status: string; // "ONTEAM"|"FREEAGENT" idk what else, maybe waivers?
}

interface EspnOwnedPlayer {
    lineupSlotId?: number;
    playerId?: number;
    status?: string;
    injuryStatus?: string;
    playerPoolEntry?: EspnPlayerPoolEntry;
    acquisitionDate?: any;
    acquisitionType?: any;
}

export interface EspnMajorLeaguePlayer {
    id: number;
    status?: string;
    onTeamId?: any;
    player?: EspnPlayerInfo;
}

interface EspnCumulativeScore {
    losses?: number;
    wins?: number;
    ties?: number;
    statBySlot?: object;
    scoreByStat?: object;
}

interface EspnRoster {
    entries: EspnPlayerInfo[];
}

interface EspnScoreObj {
    teamId?: number;
    tiebreak?: number;
    totalPoints?: number;
    totalPointsLive?: number;
    adjustment?: number;
    cumulativeScore?: EspnCumulativeScore;
    rosterForCurrentScoringPeriod?: EspnRoster;
    rosterForMatchupPeriod?: EspnRoster;
}

interface EspnScheduleItem {
    id: number;
    winner?: "HOME" | "AWAY" | "UNDECIDED";
    home?: EspnScoreObj;
    away?: EspnScoreObj;
    playoffTierType?: string;
}

type EspnSchedule = EspnScheduleItem[];

export default class EspnAPI {
    private readonly leagueId: number;
    private req: AxiosInstance;
    private espn2Cookie = process.env.ESPN_COOKIE;
    private espnSwid = process.env.ESPN_SWID;

    constructor(leagueId: number) {
        this.leagueId = leagueId;
        this.req = axios.create({
            withCredentials: true,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            headers: { Cookie: `espn_s2=${this.espn2Cookie}; SWID=${this.espnSwid};` },
            timeout: 30000,
        });
    }

    private static getBaseUrl(season = 2021, leagueId: number): string {
        if (season >= 2017) {
            return `https://fantasy.espn.com/apis/v3/games/flb/seasons/${season}/segments/0/leagues/${leagueId}`;
        } else {
            return `https://fantasy.espn.com/apis/v3/games/flb/leagueHistory/${leagueId}?seasonId=${season}`;
        }
    }

    private static sleep(ms = 5000) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access */
    public async getAllLeagueData(year: number): Promise<any> {
        const { data } = await this.req.get(`${EspnAPI.getBaseUrl(year, this.leagueId)}`);
        return data;
    }

    public async getAllMembers(year: number): Promise<EspnLeagueMember[]> {
        const { data: members } = await this.req.get(`${EspnAPI.getBaseUrl(year, this.leagueId)}/members`);
        return members;
    }

    public async getAllLeagueTeams(year: number): Promise<EspnFantasyTeam[]> {
        const { data: teams } = await this.req.get(`${EspnAPI.getBaseUrl(year, this.leagueId)}/teams?view=mTeam`);
        return teams;
    }

    public async getAllMajorLeaguePlayers(year: number): Promise<EspnMajorLeaguePlayer[]> {
        let total = 0;
        const players: EspnMajorLeaguePlayer[] = [];
        let serverTotal = 0;
        let offset = 0;

        do {
            const { data, headers } = await this.req.get<{ players: EspnMajorLeaguePlayer[] }>(
                `${EspnAPI.getBaseUrl(year, this.leagueId)}?view=kona_player_info`,
                {
                    headers: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        "X-Fantasy-Filter": `{"players": { "limit": 100, "offset": ${offset}, "sortPercOwned": { "sortAsc": false, "sortPriority": 1 } } }`,
                    },
                }
            );
            players.push(...data.players);
            total += data.players.length;
            offset += 100;
            serverTotal = serverTotal > 0 ? serverTotal : Number(headers["x-fantasy-filter-player-count"]);
            await EspnAPI.sleep();
        } while (serverTotal > 0 && total < serverTotal);

        return players;
    }

    public async getScheduleForYear(year: number): Promise<EspnSchedule> {
        const { data: schedule } = await this.req.get(
            `${EspnAPI.getBaseUrl(year, this.leagueId)}/schedule?view=mScoreboard`
        );
        return schedule;
    }

    public async getRosterForTeamAndDay(year: number, teamId: number, scoringPeriodId: number): Promise<EspnRoster> {
        const {
            data: { teams: teams },
        } = await this.req.get(
            `${EspnAPI.getBaseUrl(
                year,
                this.leagueId
            )}?forTeamId=${teamId}&scoringPeriodId=${scoringPeriodId}&view=mRoster`
        );
        return teams[0].roster;
    }

    public async updateMajorLeaguePlayers(year: number, playerDAO: PlayerDAO, teamDao: TeamDAO): Promise<Player[]> {
        logger.debug("fetching teams with ESPN teams associated");
        const allLeagueTeamsWithEspn = await teamDao.findTeams(cleanupQuery({ espnId: "!null" }));
        logger.debug(`making espn api call for year: ${year}`);
        const allEspnPlayers = await this.getAllMajorLeaguePlayers(year);
        logger.debug("mapping to player objects");
        const allPlayers = allEspnPlayers.map(player => {
            const p = Player.convertEspnMajorLeaguerToPlayer(player);
            p.leagueTeam = allLeagueTeamsWithEspn.find(t => t.espnId === p.meta.espnPlayer.onTeamId);
            return p;
        });
        logger.debug("deduping all players");
        const dedupedPlayers = uniqWith(
            allPlayers,
            (player1, player2) => player1.name === player2.name && player1.playerDataId === player2.playerDataId
        );
        logger.debug("batch save to db");
        return await playerDAO.batchUpsertPlayers(dedupedPlayers);
    }

    public async updateEspnTeamInfo(year: number, teamDao: TeamDAO): Promise<void> {
        logger.debug("reloading ESPN league team objects");
        const allEspnTeams = await this.getAllLeagueTeams(year);
        logger.debug("got all espn fantasy teams");
        const allLeagueTeams = await teamDao.getAllTeams();
        for (const team of allLeagueTeams) {
            const associatedEspnTeam = allEspnTeams.find(
                (foundEspnTeam: EspnFantasyTeam) => foundEspnTeam.id === team.espnId
            );

            if (associatedEspnTeam) {
                await teamDao.updateTeam(team.id!, {
                    espnTeam: associatedEspnTeam,
                    name: `${associatedEspnTeam.location} ${associatedEspnTeam.nickname}` || team.name,
                });
            }
        }
    }
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access */
