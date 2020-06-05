import Player, { PlayerLeagueType } from "../../src/models/player";
import { v4 as uuid } from "uuid";

export class PlayerFactory {
    public static NAME = "Honus Wiener";

    public static getPlayerObject(name = PlayerFactory.NAME, league = PlayerLeagueType.MINOR, rest = {}) {
        return { name, league, id: uuid(), ...rest };
    }

    public static getPlayer(name = PlayerFactory.NAME, league = PlayerLeagueType.MINOR, rest = {}) {
        return new Player(PlayerFactory.getPlayerObject(name, league, rest));
    }
}
