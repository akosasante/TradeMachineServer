import { EspnLeagueMember } from "../../src/espn/espnApi";

export class EspnFactory {
    public static getMember(): EspnLeagueMember {
        return {id: "random-id", isLeagueManager: true, displayName: "Cam Macdoodle"};
    }
}
