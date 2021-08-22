import {MigrationInterface, QueryRunner} from "typeorm";

export class addHydratedTrades1629664363020 implements MigrationInterface {
    name = 'addHydratedTrades1629664363020'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_trades" AS 
    WITH trade_creator AS (
        SELECT p."tradeId", (SELECT "name" FROM dev."team" tm WHERE tm.id = p."teamId")
        FROM dev.trade_participant p
        WHERE p."participantType" = '1'::dev."trade_participant_participanttype_enum"
    ),
         trade_recipients AS (
             SELECT p."tradeId", (SELECT "name" FROM dev."team" tm WHERE tm.id = p."teamId")
             FROM dev.trade_participant p
             WHERE p."participantType" = '2'::dev."trade_participant_participanttype_enum"
         ),
         accepted_users AS (
             SELECT t.id, json_array_elements_text(t."acceptedBy"::json) AS "acceptedById"
             FROM dev."trade" t
         ),
         players_with_participants AS (
             SELECT i."tradeId",
                    (SELECT "name" FROM dev."team" tm WHERE tm.id = i."senderId")    AS "sender",
                    (SELECT "name" FROM dev."team" tm WHERE tm.id = i."recipientId") AS "recipient",
                    p.*
             FROM dev."trade_item" i
                      RIGHT JOIN dev."hydrated_majors" p ON p."id" = i."tradeItemId"
             WHERE i."tradeItemType" = '1'
         ),
         traded_players AS (
             SELECT i."tradeId", array_to_json(array_agg(row_to_json(p))) AS "tradedMajors"
             FROM dev."trade_item" i
                      RIGHT JOIN "players_with_participants" p ON p."tradeId" = i."tradeId"
             WHERE i."tradeItemType" = '1'
               AND i."tradeItemId" IN (p.id)
             GROUP BY i."tradeId"
         ),
         prospects_with_participants AS (
             SELECT i."tradeId",
                    (SELECT "name" FROM dev."team" tm WHERE tm.id = i."senderId")    AS "sender",
                    (SELECT "name" FROM dev."team" tm WHERE tm.id = i."recipientId") AS "recipient",
                    p.*
             FROM dev."trade_item" i
                      RIGHT JOIN dev."hydrated_minors" p ON p."id" = i."tradeItemId"
             WHERE i."tradeItemType" = '1'
         ),
         traded_minors AS (
             SELECT i."tradeId", array_to_json(array_agg(row_to_json(p)))::jsonb AS "tradedMinors"
             FROM dev."trade_item" i
                      RIGHT JOIN "prospects_with_participants" p ON p."tradeId" = i."tradeId"
             WHERE i."tradeItemType" = '1'
               AND i."tradeItemId" IN (p.id)
             GROUP BY i."tradeId"
         ),
         picks_with_participants AS (
             SELECT i."tradeId",
                    (SELECT "name" FROM dev."team" tm WHERE tm.id = i."senderId")    AS "sender",
                    (SELECT "name" FROM dev."team" tm WHERE tm.id = i."recipientId") AS "recipient",
                    d.*
             FROM dev."trade_item" i
                      RIGHT JOIN dev."hydrated_picks" d ON d."id" = i."tradeItemId"
             WHERE i."tradeItemType" = '2'
         ),
         traded_picks AS (
             SELECT i."tradeId", array_to_json(array_agg(row_to_json(d))) AS "tradedPicks"
             FROM dev."trade_item" i
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
            FROM dev."user" u
            WHERE u.id = t."declinedById")                                                              AS "decliningUser",
           t."declinedReason",
           (SELECT array_agg("displayName")
            FROM dev."user" u
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
    FROM dev.trade t;
`);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_trades","WITH trade_creator AS (\n        SELECT p.\"tradeId\", (SELECT \"name\" FROM dev.\"team\" tm WHERE tm.id = p.\"teamId\")\n        FROM dev.trade_participant p\n        WHERE p.\"participantType\" = '1'::dev.\"trade_participant_participanttype_enum\"\n    ),\n         trade_recipients AS (\n             SELECT p.\"tradeId\", (SELECT \"name\" FROM dev.\"team\" tm WHERE tm.id = p.\"teamId\")\n             FROM dev.trade_participant p\n             WHERE p.\"participantType\" = '2'::dev.\"trade_participant_participanttype_enum\"\n         ),\n         accepted_users AS (\n             SELECT t.id, json_array_elements_text(t.\"acceptedBy\"::json) AS \"acceptedById\"\n             FROM dev.\"trade\" t\n         ),\n         players_with_participants AS (\n             SELECT i.\"tradeId\",\n                    (SELECT \"name\" FROM dev.\"team\" tm WHERE tm.id = i.\"senderId\")    AS \"sender\",\n                    (SELECT \"name\" FROM dev.\"team\" tm WHERE tm.id = i.\"recipientId\") AS \"recipient\",\n                    p.*\n             FROM dev.\"trade_item\" i\n                      RIGHT JOIN dev.\"hydrated_majors\" p ON p.\"id\" = i.\"tradeItemId\"\n             WHERE i.\"tradeItemType\" = '1'\n         ),\n         traded_players AS (\n             SELECT i.\"tradeId\", array_to_json(array_agg(row_to_json(p))) AS \"tradedMajors\"\n             FROM dev.\"trade_item\" i\n                      RIGHT JOIN \"players_with_participants\" p ON p.\"tradeId\" = i.\"tradeId\"\n             WHERE i.\"tradeItemType\" = '1'\n               AND i.\"tradeItemId\" IN (p.id)\n             GROUP BY i.\"tradeId\"\n         ),\n         prospects_with_participants AS (\n             SELECT i.\"tradeId\",\n                    (SELECT \"name\" FROM dev.\"team\" tm WHERE tm.id = i.\"senderId\")    AS \"sender\",\n                    (SELECT \"name\" FROM dev.\"team\" tm WHERE tm.id = i.\"recipientId\") AS \"recipient\",\n                    p.*\n             FROM dev.\"trade_item\" i\n                      RIGHT JOIN dev.\"hydrated_minors\" p ON p.\"id\" = i.\"tradeItemId\"\n             WHERE i.\"tradeItemType\" = '1'\n         ),\n         traded_minors AS (\n             SELECT i.\"tradeId\", array_to_json(array_agg(row_to_json(p)))::jsonb AS \"tradedMinors\"\n             FROM dev.\"trade_item\" i\n                      RIGHT JOIN \"prospects_with_participants\" p ON p.\"tradeId\" = i.\"tradeId\"\n             WHERE i.\"tradeItemType\" = '1'\n               AND i.\"tradeItemId\" IN (p.id)\n             GROUP BY i.\"tradeId\"\n         ),\n         picks_with_participants AS (\n             SELECT i.\"tradeId\",\n                    (SELECT \"name\" FROM dev.\"team\" tm WHERE tm.id = i.\"senderId\")    AS \"sender\",\n                    (SELECT \"name\" FROM dev.\"team\" tm WHERE tm.id = i.\"recipientId\") AS \"recipient\",\n                    d.*\n             FROM dev.\"trade_item\" i\n                      RIGHT JOIN dev.\"hydrated_picks\" d ON d.\"id\" = i.\"tradeItemId\"\n             WHERE i.\"tradeItemType\" = '2'\n         ),\n         traded_picks AS (\n             SELECT i.\"tradeId\", array_to_json(array_agg(row_to_json(d))) AS \"tradedPicks\"\n             FROM dev.\"trade_item\" i\n                      RIGHT JOIN \"picks_with_participants\" d ON d.\"tradeId\" = i.\"tradeId\"\n             WHERE i.\"tradeItemType\" = '2'\n               AND i.\"tradeItemId\" IN (d.id)\n             GROUP BY i.\"tradeId\"\n         )\n    SELECT t.id                                                                                         AS \"tradeId\",\n           t.\"dateCreated\",\n           t.status                                                                                     AS \"tradeStatus\",\n           (SELECT \"name\" FROM trade_creator tc WHERE tc.\"tradeId\" = t.id)                              AS \"tradeCreator\",\n           (SELECT array_agg(\"name\")\n            FROM trade_recipients tr\n            WHERE tr.\"tradeId\" = t.id)                                                                  AS \"tradeRecipients\",\n           (SELECT \"displayName\"\n            FROM dev.\"user\" u\n            WHERE u.id = t.\"declinedById\")                                                              AS \"decliningUser\",\n           t.\"declinedReason\",\n           (SELECT array_agg(\"displayName\")\n            FROM dev.\"user\" u\n                     LEFT JOIN accepted_users on t.id = accepted_users.id\n            WHERE u.id = \"accepted_users\".\"acceptedById\"::uuid)                                         AS \"acceptingUsers\",\n           t.\"acceptedOnDate\",\n           (SELECT \"tradedMajors\"\n            FROM \"traded_players\" tp\n            WHERE tp.\"tradeId\" = t.id)                                                                  AS \"tradedMajors\",\n           (SELECT \"tradedMinors\"\n            FROM \"traded_minors\" tp\n            WHERE tp.\"tradeId\" = t.id)                                                                  AS \"tradedMinors\",\n           (SELECT \"tradedPicks\" FROM \"traded_picks\" tp WHERE tp.\"tradeId\" = t.id)                      AS \"tradedPicks\"\n    FROM dev.trade t;"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_trades"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_trades"`);
    }

}
