import DraftPick, { LeagueLevel } from "../../src/models/draftPick";
import { v4 as uuid } from "uuid";
import { TeamFactory } from "./TeamFactory";

export class DraftPickFactory {
    public static getPickObject(round = 1, pickNumber = 12, type = LeagueLevel.LOW, season = 2020, originalOwner = TeamFactory.getTeam(), rest = {}) {
        return { round, pickNumber, type, season, originalOwner, id: uuid(), ...rest };
    }

    public static getPick(round = 1, pickNumber = 12, type = LeagueLevel.LOW, season = 2020, originalOwner = TeamFactory.getTeam(),  rest = {}) {
        return new DraftPick(DraftPickFactory.getPickObject(round, pickNumber, type, season, originalOwner, rest));
    }
}
