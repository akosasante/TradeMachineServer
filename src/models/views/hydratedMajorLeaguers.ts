import { ViewColumn, ViewEntity } from "typeorm";
import { PlayerLeagueType } from "../player";

interface OwnerTeamMap {
    id: string;
    name: string;
}

@ViewEntity({
    name: "hydrated_majors",
    expression: `
        -- noinspection SqlResolve

SELECT id,
               name,
               league,
               COALESCE("mlbTeam", meta ->> 'proTeamId')           AS "mlbTeam",
               (SELECT json_build_object('id', "id", 'name', "name")
                FROM ${process.env.PG_SCHEMA || "public"}.team t
                WHERE t.id = "leagueTeamId")                       AS "ownerTeam",
               meta -> 'espnPlayer' -> 'player' -> 'eligibleSlots' AS "eligiblePositions",
               meta -> 'position'                                  AS "mainPosition"
        FROM ${process.env.PG_SCHEMA || "public"}.player
        WHERE ${process.env.PG_SCHEMA || "public"}.player.league::text = '1';
    `,
})
export class HydratedMajorLeaguer {
    @ViewColumn()
    public id?: string;

    @ViewColumn()
    public name?: string;

    @ViewColumn()
    public league?: PlayerLeagueType;

    @ViewColumn()
    public mlbTeam?: string;

    @ViewColumn()
    public ownerTeam?: OwnerTeamMap;

    @ViewColumn()
    public eligiblePositions?: number[];

    @ViewColumn()
    public mainPosition?: string;

    constructor(props: Partial<HydratedMajorLeaguer>) {
        return Object.assign({}, props);
    }
}
