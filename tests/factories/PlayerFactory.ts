import Player, { PlayerLeagueType } from "../../src/models/player";
import { v4 as uuid } from "uuid";

export class PlayerFactory {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static NAME = "Honus Wiener";

    public static getPlayerObject(name = PlayerFactory.NAME, league = PlayerLeagueType.MINOR, rest = {}) {
        return { name, league, id: uuid(), ...rest };
    }

    public static getPlayer(name = PlayerFactory.NAME, league = PlayerLeagueType.MINOR, rest = {}) {
        return new Player(PlayerFactory.getPlayerObject(name, league, rest));
    }
}
