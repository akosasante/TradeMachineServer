import {MigrationInterface, QueryRunner} from "typeorm";

export class addHydratedTradeView1621484935872 implements MigrationInterface {
    name = 'addHydratedTradeView1621484935872'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_trades" AS WITH trade_creator AS (
    SELECT p."tradeId", (SELECT "name" FROM "team" tm WHERE tm.id = p."teamId") FROM trade_participant p WHERE p."participantType" = '1'
),
     trade_recipients AS (
         SELECT p."tradeId", (SELECT "name" FROM "team" tm WHERE tm.id = p."teamId") FROM trade_participant p WHERE p."participantType" = '2'
     ),
     accepted_users AS (
         SELECT t.id, json_array_elements_text(t."acceptedBy"::json) AS "acceptedById" FROM "trade" t
     ),
     traded_players AS (
         SELECT i."tradeId", array_to_json(array_agg(row_to_json(p))) AS "tradedMajors" FROM "trade_item" i
         RIGHT JOIN "hydrated_majors" p ON p."id" = i."tradeItemId"
         WHERE i."tradeItemType" = '1'
         GROUP BY i."tradeId"
     ),
     traded_minors AS (
         SELECT i."tradeId", array_to_json(array_agg(row_to_json(p)))AS "tradedMinors" FROM "trade_item" i
         RIGHT JOIN "hydrated_minors" p ON p."id" = i."tradeItemId"
         WHERE i."tradeItemType" = '1'
         GROUP BY i."tradeId"
     ),
     traded_picks AS (
         SELECT i."tradeId", array_to_json(array_agg(row_to_json(d))) AS "tradedPicks" FROM "trade_item" i
         RIGHT JOIN "hydrated_picks" d ON d."id" = i."tradeItemId"
         WHERE i."tradeItemType" = '2'
         GROUP BY i."tradeId"
     )
SELECT t.id AS "tradeId",
       t."dateCreated",
       t.status AS "tradeStatus",
       (SELECT "name" FROM trade_creator tc WHERE tc."tradeId" = t.id) AS "tradeCreator",
       (SELECT array_agg("name") FROM trade_recipients tr WHERE tr."tradeId" = t.id) AS "tradeRecipients",
       (SELECT "displayName" FROM "user" u WHERE u.id = t."declinedById") AS "decliningUser",
       t."declinedReason",
       (SELECT array_agg("displayName") FROM "user" u LEFT JOIN accepted_users on t.id = accepted_users.id WHERE u.id = "accepted_users"."acceptedById"::uuid) AS "acceptingUsers",
       t."acceptedOnDate",
       (SELECT "tradedMajors" FROM "traded_players" tp WHERE tp."tradeId" = t.id) AS "tradedMajors",
       (SELECT "tradedMinors" FROM "traded_minors" tp WHERE tp."tradeId" = t.id) AS "tradedMinors",
       (SELECT "tradedPicks" FROM "traded_picks" tp WHERE tp."tradeId" = t.id) AS "tradedPicks"
FROM trade t;`);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_trades","WITH trade_creator AS (\n    SELECT p.\"tradeId\", (SELECT \"name\" FROM \"team\" tm WHERE tm.id = p.\"teamId\") FROM trade_participant p WHERE p.\"participantType\" = '1'\n),\n     trade_recipients AS (\n         SELECT p.\"tradeId\", (SELECT \"name\" FROM \"team\" tm WHERE tm.id = p.\"teamId\") FROM trade_participant p WHERE p.\"participantType\" = '2'\n     ),\n     accepted_users AS (\n         SELECT t.id, json_array_elements_text(t.\"acceptedBy\"::json) AS \"acceptedById\" FROM \"trade\" t\n     ),\n     traded_players AS (\n         SELECT i.\"tradeId\", array_to_json(array_agg(row_to_json(p))) AS \"tradedMajors\" FROM \"trade_item\" i\n         RIGHT JOIN \"hydrated_majors\" p ON p.\"id\" = i.\"tradeItemId\"\n         WHERE i.\"tradeItemType\" = '1'\n         GROUP BY i.\"tradeId\"\n     ),\n     traded_minors AS (\n         SELECT i.\"tradeId\", array_to_json(array_agg(row_to_json(p)))AS \"tradedMinors\" FROM \"trade_item\" i\n         RIGHT JOIN \"hydrated_minors\" p ON p.\"id\" = i.\"tradeItemId\"\n         WHERE i.\"tradeItemType\" = '1'\n         GROUP BY i.\"tradeId\"\n     ),\n     traded_picks AS (\n         SELECT i.\"tradeId\", array_to_json(array_agg(row_to_json(d))) AS \"tradedPicks\" FROM \"trade_item\" i\n         RIGHT JOIN \"hydrated_picks\" d ON d.\"id\" = i.\"tradeItemId\"\n         WHERE i.\"tradeItemType\" = '2'\n         GROUP BY i.\"tradeId\"\n     )\nSELECT t.id AS \"tradeId\",\n       t.\"dateCreated\",\n       t.status AS \"tradeStatus\",\n       (SELECT \"name\" FROM trade_creator tc WHERE tc.\"tradeId\" = t.id) AS \"tradeCreator\",\n       (SELECT array_agg(\"name\") FROM trade_recipients tr WHERE tr.\"tradeId\" = t.id) AS \"tradeRecipients\",\n       (SELECT \"displayName\" FROM \"user\" u WHERE u.id = t.\"declinedById\") AS \"decliningUser\",\n       t.\"declinedReason\",\n       (SELECT array_agg(\"displayName\") FROM \"user\" u LEFT JOIN accepted_users on t.id = accepted_users.id WHERE u.id = \"accepted_users\".\"acceptedById\"::uuid) AS \"acceptingUsers\",\n       t.\"acceptedOnDate\",\n       (SELECT \"tradedMajors\" FROM \"traded_players\" tp WHERE tp.\"tradeId\" = t.id) AS \"tradedMajors\",\n       (SELECT \"tradedMinors\" FROM \"traded_minors\" tp WHERE tp.\"tradeId\" = t.id) AS \"tradedMinors\",\n       (SELECT \"tradedPicks\" FROM \"traded_picks\" tp WHERE tp.\"tradeId\" = t.id) AS \"tradedPicks\"\nFROM trade t;"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_trades"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_trades"`);
    }

}
