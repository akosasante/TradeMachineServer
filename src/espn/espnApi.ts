import axios, { AxiosInstance } from "axios";

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
    streakType: "WIN"|"LOSS"|string;
    ties: number;
    wins: number;
}

interface EspnRecordObj {
    away: EspnRecord;
    home: EspnRecord;
    division: EspnRecord;
    overall: EspnRecord;
}

interface EspnFantasyTeam {
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
    eligibleSlots?: number[]; // TODO: figure out what this maps to
    defaultPositionId?: number; // TODO: Map position number to position text
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
    status: string; // "ONTEAM" idk what else
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

interface EspnMajorLeaguePlayer {
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
    winner?: "HOME"|"AWAY"|"UNDECIDED";
    home?: EspnScoreObj;
    away?: EspnScoreObj;
    playoffTierType?: string;
}

type EspnSchedule = EspnScheduleItem[];


export default class EspnAPI {
    private leagueId: number;
    private req: AxiosInstance;
    private ESPNS2_COOKIE = process.env.ESPN_COOKIE;
    private ESPN_SWID = process.env.ESPN_SWID;
    private static getBaseUrl(season: number = 2019, leagueId: number): string {
        if (season >= 2017) {
            return `http://fantasy.espn.com/apis/v3/games/flb/seasons/${season}/segments/0/leagues/${leagueId}`;
        } else {
            return `https://fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}?seasonId=${season}`;
        }
    }

    constructor(leagueId: number) {
        this.leagueId = leagueId;
        this.req = axios.create({
            withCredentials: true,
            headers: {Cookie: `espn_s2=${this.ESPNS2_COOKIE}; SWID=${this.ESPN_SWID};`},
        });
    }

    public async getAllLeagueData(year: number) {
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
        const { data: {players: players} } = await this.req.get(`${EspnAPI.getBaseUrl(year, this.leagueId)}?view=kona_player_info`);
        return players;
    }

    public async getScheduleForYear(year: number): Promise<EspnSchedule> {
        const { data: schedule } = await this.req.get(`${EspnAPI.getBaseUrl(year, this.leagueId)}/schedule?view=mScoreboard`);
        return schedule;
    }

    public async getRosterForTeamAndDay(year: number, teamId: number, scoringPeriodId: number): Promise<EspnRoster> {
        const { data: {teams: teams} } = await this.req.get(`${EspnAPI.getBaseUrl(year, this.leagueId)}?forTeamId=${teamId}&scoringPeriodId=${scoringPeriodId}&view=mRoster`);
        return teams[0].roster;
    }
}
