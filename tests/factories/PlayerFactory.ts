import Player, { PlayerLeagueType } from "../../src/models/player";
import { Player as PrismaPlayer, PlayerLeagueLevel } from "@prisma/client";
import { v4 as uuid } from "uuid";
import { faker } from "@faker-js/faker";

export class PlayerFactory {
    public static NAME = "Honus Wiener";

    public static getPlayerObject(
        name = PlayerFactory.NAME,
        league = PlayerLeagueType.MINOR,
        rest = {}
    ): {
        name: string;
        league: PlayerLeagueType;
        id: string;
    } {
        return { name, league, id: uuid(), ...rest };
    }

    public static getPlayer(name = PlayerFactory.NAME, league = PlayerLeagueType.MINOR, rest = {}): Player {
        return new Player(PlayerFactory.getPlayerObject(name, league, rest));
    }

    public static getPrismaPlayer(
        name = faker.name.fullName(),
        league = PlayerLeagueLevel.MINORS,
        _rest = {}
    ): PrismaPlayer {
        return {
            id: uuid(),
            dateCreated: new Date(),
            dateModified: new Date(),
            name,
            league,
            mlbTeam: null,
            meta: {},
            playerDataId: parseInt(faker.random.numeric(5), 10),
            leagueTeamId: null,
        };
    }
}
