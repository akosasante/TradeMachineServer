import { ViewColumn, ViewEntity } from "typeorm";
import { TradeStatus } from "../trade";
import { HydratedPick } from "./hydratedPicks";
import { HydratedMajorLeaguer } from "./hydratedMajorLeaguers";
import { HydratedMinorLeaguer } from "./hydratedMinorLeaguers";

const expression = `
    -- noinspection SqlResolve

WITH trade_creator AS (
        SELECT p."tradeId", (SELECT "name" FROM ${process.env.PG_SCHEMA || "public"}."team" tm WHERE tm.id = p."teamId")
        FROM ${process.env.PG_SCHEMA || "public"}.trade_participant p
        WHERE p."participantType" = '1'::${process.env.PG_SCHEMA || "public"}."trade_participant_participanttype_enum"
    ),
         trade_recipients AS (
             SELECT p."tradeId", (SELECT "name" FROM ${
                 process.env.PG_SCHEMA || "public"
             }."team" tm WHERE tm.id = p."teamId")
             FROM ${process.env.PG_SCHEMA || "public"}.trade_participant p
             WHERE p."participantType" = '2'::${
                 process.env.PG_SCHEMA || "public"
             }."trade_participant_participanttype_enum"
         ),
         accepted_users AS (
             SELECT t.id, json_array_elements_text(t."acceptedBy"::json) AS "acceptedById"
             FROM ${process.env.PG_SCHEMA || "public"}."trade" t
         ),
         players_with_participants AS (
             SELECT i."tradeId",
                    (SELECT "name" FROM ${
                        process.env.PG_SCHEMA || "public"
                    }."team" tm WHERE tm.id = i."senderId")    AS "sender",
                    (SELECT "name" FROM ${
                        process.env.PG_SCHEMA || "public"
                    }."team" tm WHERE tm.id = i."recipientId") AS "recipient",
                    p.*
             FROM ${process.env.PG_SCHEMA || "public"}."trade_item" i
                      RIGHT JOIN ${process.env.PG_SCHEMA || "public"}."hydrated_majors" p ON p."id" = i."tradeItemId"
             WHERE i."tradeItemType" = '1'
         ),
         traded_players AS (
             SELECT i."tradeId", array_to_json(array_agg(row_to_json(p))) AS "tradedMajors"
             FROM ${process.env.PG_SCHEMA || "public"}."trade_item" i
                      RIGHT JOIN "players_with_participants" p ON p."tradeId" = i."tradeId"
             WHERE i."tradeItemType" = '1'
               AND i."tradeItemId" IN (p.id)
             GROUP BY i."tradeId"
         ),
         prospects_with_participants AS (
             SELECT i."tradeId",
                    (SELECT "name" FROM ${
                        process.env.PG_SCHEMA || "public"
                    }."team" tm WHERE tm.id = i."senderId")    AS "sender",
                    (SELECT "name" FROM ${
                        process.env.PG_SCHEMA || "public"
                    }."team" tm WHERE tm.id = i."recipientId") AS "recipient",
                    p.*
             FROM ${process.env.PG_SCHEMA || "public"}."trade_item" i
                      RIGHT JOIN ${process.env.PG_SCHEMA || "public"}."hydrated_minors" p ON p."id" = i."tradeItemId"
             WHERE i."tradeItemType" = '1'
         ),
         traded_minors AS (
             SELECT i."tradeId", array_to_json(array_agg(row_to_json(p)))::jsonb AS "tradedMinors"
             FROM ${process.env.PG_SCHEMA || "public"}."trade_item" i
                      RIGHT JOIN "prospects_with_participants" p ON p."tradeId" = i."tradeId"
             WHERE i."tradeItemType" = '1'
               AND i."tradeItemId" IN (p.id)
             GROUP BY i."tradeId"
         ),
         picks_with_participants AS (
             SELECT i."tradeId",
                    (SELECT "name" FROM ${
                        process.env.PG_SCHEMA || "public"
                    }."team" tm WHERE tm.id = i."senderId")    AS "sender",
                    (SELECT "name" FROM ${
                        process.env.PG_SCHEMA || "public"
                    }."team" tm WHERE tm.id = i."recipientId") AS "recipient",
                    d.*
             FROM ${process.env.PG_SCHEMA || "public"}."trade_item" i
                      RIGHT JOIN ${process.env.PG_SCHEMA || "public"}."hydrated_picks" d ON d."id" = i."tradeItemId"
             WHERE i."tradeItemType" = '2'
         ),
         traded_picks AS (
             SELECT i."tradeId", array_to_json(array_agg(row_to_json(d))) AS "tradedPicks"
             FROM ${process.env.PG_SCHEMA || "public"}."trade_item" i
                      RIGHT JOIN "picks_with_participants" d ON d."tradeId" = i."tradeId"
             WHERE i."tradeItemType" = '2'
               AND i."tradeItemId" IN (d.id)
             GROUP BY i."tradeId"
         )
    SELECT t.id                                                                                         AS "tradeId",
           t."dateCreated",
           t.status                                                                                     AS "tradeStatus",
           (SELECT "name" FROM trade_creator tc WHERE tc."tradeId" = t.id)                              AS "tradeCreator",
           (SELECT array_agg("name")
            FROM trade_recipients tr
            WHERE tr."tradeId" = t.id)                                                                  AS "tradeRecipients",
           (SELECT "displayName"
            FROM ${process.env.PG_SCHEMA || "public"}."user" u
            WHERE u.id = t."declinedById")                                                              AS "decliningUser",
           t."declinedReason",
           (SELECT array_agg("displayName")
            FROM ${process.env.PG_SCHEMA || "public"}."user" u
                     LEFT JOIN accepted_users on t.id = accepted_users.id
            WHERE u.id = "accepted_users"."acceptedById"::uuid)                                         AS "acceptingUsers",
           t."acceptedOnDate",
           (SELECT "tradedMajors"
            FROM "traded_players" tp
            WHERE tp."tradeId" = t.id)                                                                  AS "tradedMajors",
           (SELECT "tradedMinors"
            FROM "traded_minors" tp
            WHERE tp."tradeId" = t.id)                                                                  AS "tradedMinors",
           (SELECT "tradedPicks" FROM "traded_picks" tp WHERE tp."tradeId" = t.id)                      AS "tradedPicks"
    FROM ${process.env.PG_SCHEMA || "public"}.trade t;
`;

@ViewEntity({
    name: "hydrated_trades",
    expression,
})
export class HydratedTrade {
    @ViewColumn()
    public tradeId?: string;

    @ViewColumn()
    public dateCreated?: Date;

    @ViewColumn()
    public tradeStatus?: TradeStatus;

    @ViewColumn()
    public tradeCreator?: string;

    @ViewColumn()
    public tradeRecipients?: string[];

    @ViewColumn()
    public decliningUser?: string;

    @ViewColumn()
    public declinedReason?: string;

    @ViewColumn()
    public acceptingUsers?: string[];

    @ViewColumn()
    public acceptedOnDate?: Date;

    @ViewColumn()
    public tradedMajors?: HydratedMajorLeaguer[];

    @ViewColumn()
    public tradedMinors?: HydratedMinorLeaguer[];

    @ViewColumn()
    public tradedPicks?: HydratedPick[];

    constructor(props: Partial<HydratedTrade>) {
        return Object.assign({}, props);
    }
}
