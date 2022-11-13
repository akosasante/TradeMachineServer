import { faker } from "@faker-js/faker";
import Team from "../../src/models/team";
import { v4 as uuid } from "uuid";
import { espnIdCounter } from "./Counter";

export class TeamFactory {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static NAME = "Squirtle Squad";

    public static getTeamObject(name = TeamFactory.NAME, espnId = espnIdCounter(), rest = {}) {
        return { id: uuid(), name, espnId, ...rest };
    }

    public static getTeam(name = TeamFactory.NAME, espnId = espnIdCounter(), rest = {}) {
        return new Team(TeamFactory.getTeamObject(name, espnId, rest));
    }

    public static getTeams(num: number) {
        const names = ["Squirtle Squad", "Mr. Mime Mob"];
        let name: string;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        return [...Array(num)].map((_, i) => {
            if (i + 1 > names.length) {
                name = faker.name.firstName();
            } else {
                name = names[i];
            }
            return TeamFactory.getTeam(name, i + 1);
        });
    }
}
