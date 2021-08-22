import { ViewColumn, ViewEntity } from "typeorm";
import { LeagueLevel } from "../draftPick";

interface OwnerTeamMap {
    id: string;
    name: string;
}

@ViewEntity({
    name: "hydrated_picks",
    expression: `
        SELECT id,
               season,
               "type",
               round,
               "pickNumber",
               (SELECT json_build_object('id', "id", 'name', "name")
                FROM ${process.env.PG_SCHEMA}.team t
                WHERE t.id = "currentOwnerId")  AS "currentPickHolder",
               (SELECT json_build_object('id', "id", 'name', "name")
                FROM ${process.env.PG_SCHEMA}.team t
                WHERE t.id = "originalOwnerId") AS "originalPickOwner"
        FROM ${process.env.PG_SCHEMA}.draft_pick;
    `,
})
export class HydratedPick {
    @ViewColumn()
    public id?: string;

    @ViewColumn()
    public season?: number;

    @ViewColumn()
    public type?: LeagueLevel;

    @ViewColumn()
    public round?: number;

    @ViewColumn()
    public pickNumber?: number;

    @ViewColumn()
    public currentPickHolder?: OwnerTeamMap;

    @ViewColumn()
    public originalPickOwner?: OwnerTeamMap;

    constructor(props: Partial<HydratedPick>) {
        return Object.assign({}, props);
    }
}
