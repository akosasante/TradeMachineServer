import DraftPick from "../../src/models/draftPick";
import { LeagueLevel } from "../../src/models/player";

export class DraftPickFactory {
    public static getPickObject(round = 1, pickNumber = 12, type = LeagueLevel.LOW, rest = {}) {
        return { round, pickNumber, type, ...rest };
    }

    public static getPick(round = 1, pickNumber = 12, type = LeagueLevel.LOW, rest = {}) {
        return new DraftPick(DraftPickFactory.getPickObject(round, pickNumber, type, rest));
    }
}
