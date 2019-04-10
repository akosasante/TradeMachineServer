import axios, { AxiosInstance } from "axios";
import { NotFoundError } from "routing-controllers";

interface EspnLeagueMember {
    id: string;
    isLeagueManager: boolean;
    displayName: string;
}

interface EspnFantasyTeam {
    id: number;
    abbrev: string;
    location: string;
    nickname: string;
    owners: string[];
}

export default class EspnAPI {

    public static getTeamName(team: EspnFantasyTeam): string {
        return team ? `${team.location} ${team.nickname}` : "";
    }

    public leagueName: string = "";
    public teams: EspnFantasyTeam[] = []; // TODO: Refine type
    public members: EspnLeagueMember[] = []; // TODO: Refine type
    public leagueBaseUrl: string;

    private leagueId: number;
    private req: AxiosInstance;
    private loaded: boolean = false;
    // tslint:disable-next-line:max-line-length
    private BASE_URL: string = "http://fantasy.espn.com/apis/v3/games/flb/seasons/2019/segments/0"; // TODO: Deal with season year changing
    // tslint:disable-next-line:max-line-length
    private ESPNS2_COOKIE: string = "AEAKC%2BYZ5pDnXWWN3QjnK8pizxJbwojo%2FBzaQxaiZPjx9SdB%2F7cB%2BxrCNk%2Fk0iIzpSQLm6OsH%2BIrwfcdeJ19Y3lqjRDn1hV9%2FEGHVX6ZRGpuYjKeeowwIOr8YHlX4C6zkPk0TP1D4PInK6cEpudD80A8fxwbicDRkNZd929xntcmetjihDfPn2C70AhqZUxkOmf4P2dwjogjkZmFN3zgjCP8yfWm521yiuWR9MGaksnzv2aLpMEb36IsGZJSLbqHYfmv1QTJrjXi1nzcYHpEvfo6";
    private ESPN_SWID: string = "{D83BF7DC-2473-4A49-B53D-00000D9FF850}";

    constructor(leagueId: number) {
        this.leagueId = leagueId;
        this.leagueBaseUrl = `${this.BASE_URL}/leagues/${this.leagueId}`;
        this.req = axios.create({
            withCredentials: true,
            headers: {Cookie: `espn_s2=${this.ESPNS2_COOKIE}; SWID=${this.ESPN_SWID};`},
        });
    }

    public async loadAndRun(func: (..._: any[]) => any) {
        if (!this.loaded) {
            await this.preloadData();
        }
        return func();
    }

    public async preloadData() {
        const {data: res} = await this.req.get(`${this.leagueBaseUrl}` );
        this.members = res.members;
        this.teams = res.teams;
        this.leagueName = res.settings.name;
        this.loaded = true;
        return res;
    }

    public getTeamById(id: number): EspnFantasyTeam|undefined {
        const foundTeam = this.teams.find(team => team.id === id);
        if (foundTeam) {
            return foundTeam;
        } else {
            throw new NotFoundError(`No team with that ID found for League#${this.leagueId}`);
        }
    }

    public getEspnTeamOwners(team: EspnFantasyTeam): EspnLeagueMember[] {
        return team.owners
            .map(id => this.members.find(member => member.id === id))
            .filter(m => m !== undefined) as EspnLeagueMember[];
    }
}

// const x = new EspnAPI(545);
// x.loadAndRun(() => {
//     console.log(x.members);
//     console.log(x.getTeamName(x.getTeamById(20)!));
// });
