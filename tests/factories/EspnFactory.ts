import { EspnFantasyTeam, EspnLeagueMember } from "../../src/espn/espnApi";

export class EspnFactory {
    public static getMember(): EspnLeagueMember {
        return {id: "random-id", isLeagueManager: true, displayName: "Cam Macdoodle"};
    }

    public static getTeam(): EspnFantasyTeam {
        return {id: 1, abbrev: "LAD", location: "Los Angeles", nickname: "Dodgers"};
    }
}
