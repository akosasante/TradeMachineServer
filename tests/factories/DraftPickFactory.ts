import DraftPick from "../../src/models/draftPick";
import { LeagueLevel } from "../../src/models/player";
import { v4 as uuid } from "uuid";

export class DraftPickFactory {
    public static getPickObject(round = 1, pickNumber = 12, type = LeagueLevel.LOW, season = 2020, rest = {}) {
        return { round, pickNumber, type, season, id: uuid(), ...rest };
    }

    public static getPick(round = 1, pickNumber = 12, type = LeagueLevel.LOW, season = 2020, rest = {}) {
        return new DraftPick(DraftPickFactory.getPickObject(round, pickNumber, type, season, rest));
    }
}
