import { ViewColumn, ViewEntity } from "typeorm";
import { PlayerLeagueType } from "../player";

interface OwnerTeamMap {
    id: string;
    name: string;
}

/* eslint-disable @typescript-eslint/naming-convention */
enum MinorLeagueLevel {
    LOW = "Low",
    HIGH = "High",
}

/* eslint-enable @typescript-eslint/naming-convention */

@ViewEntity({
    name: "hydrated_minors",
    expression: `
        -- noinspection SqlResolve

SELECT id,
               name,
               league,
               (SELECT json_build_object('id', "id", 'name', "name")
                FROM ${process.env.PG_SCHEMA}.team t
                WHERE t.id = "leagueTeamId")                          AS "ownerTeam",
               meta -> 'minorLeaguePlayerFromSheet' ->> 'mlbTeam'     AS "minorTeam",
               meta -> 'minorLeaguePlayerFromSheet' ->> 'position'    as "position",
               meta -> 'minorLeaguePlayerFromSheet' ->> 'leagueLevel' as "minorLeagueLevel"
        FROM ${process.env.PG_SCHEMA}.player
        WHERE ${process.env.PG_SCHEMA}.player.league::text = '2';
    `,
})
export class HydratedMinorLeaguer {
    @ViewColumn()
    public id?: string;

    @ViewColumn()
    public name?: string;

    @ViewColumn()
    public league?: PlayerLeagueType;

    @ViewColumn()
    public minorTeam?: string;

    @ViewColumn()
    public ownerTeam?: OwnerTeamMap;

    @ViewColumn()
    public position?: number[];

    @ViewColumn()
    public minorLeagueLevel?: MinorLeagueLevel;

    constructor(props: Partial<HydratedMinorLeaguer>) {
        return Object.assign({}, props);
    }
}
