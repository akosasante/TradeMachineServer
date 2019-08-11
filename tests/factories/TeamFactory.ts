import Team from "../../src/models/team";

export class TeamFactory {
    public static NAME = "Squirtle Squad";

    public static getTeamObject(name = TeamFactory.NAME, espnId = 1, rest = {}) {
        return { name, espnId, ...rest };
    }

    public static getTeam(name = TeamFactory.NAME, espnId = 1, rest = {}) {
        return new Team(TeamFactory.getTeamObject(name, espnId, rest));
    }

    public static getTeams(num: number) {
        const names = ["Squirtle Squad", "Mr. Mime Mob"];
        let name: string;
        return [...Array(num)].map((_, i) => {
            if ((i + 1) > names.length) {
                name = names[(i + 1) % names.length];
            } else {
                name = names[i];
            }
            return TeamFactory.getTeam(name, i + 1, {id: i + 1});
        });
    }
}
