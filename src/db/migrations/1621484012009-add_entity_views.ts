import {MigrationInterface, QueryRunner} from "typeorm";

export class addEntityViews1621484012009 implements MigrationInterface {
    name = 'addEntityViews1621484012009'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_majors" AS 
        SELECT id, name, league, COALESCE("mlbTeam", meta->>'proTeamId') AS "mlbTeam", (SELECT json_build_object('id', "id", 'name', "name") FROM team t WHERE t.id = "leagueTeamId") AS "ownerTeam", meta->'espnPlayer'->'player'->'eligibleSlots' AS "eligiblePositions", meta->'position' AS "mainPosition"
        FROM player
        WHERE league = '1';
        `);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_majors","SELECT id, name, league, COALESCE(\"mlbTeam\", meta->>'proTeamId') AS \"mlbTeam\", (SELECT json_build_object('id', \"id\", 'name', \"name\") FROM team t WHERE t.id = \"leagueTeamId\") AS \"ownerTeam\", meta->'espnPlayer'->'player'->'eligibleSlots' AS \"eligiblePositions\", meta->'position' AS \"mainPosition\"\n        FROM player\n        WHERE league = '1';"]);
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_minors" AS 
      SELECT id, name, league, (SELECT json_build_object('id', "id", 'name', "name") FROM team t WHERE t.id = "leagueTeamId") AS "ownerTeam", meta->'minorLeaguePlayerFromSheet'->>'mlbTeam' AS "minorTeam", meta->'minorLeaguePlayerFromSheet'->>'position' as "position", meta->'minorLeaguePlayerFromSheet'->>'leagueLevel' as "minorLeagueLevel"
      FROM player
      WHERE league = '2';
        `);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_minors","SELECT id, name, league, (SELECT json_build_object('id', \"id\", 'name', \"name\") FROM team t WHERE t.id = \"leagueTeamId\") AS \"ownerTeam\", meta->'minorLeaguePlayerFromSheet'->>'mlbTeam' AS \"minorTeam\", meta->'minorLeaguePlayerFromSheet'->>'position' as \"position\", meta->'minorLeaguePlayerFromSheet'->>'leagueLevel' as \"minorLeagueLevel\"\n      FROM player\n      WHERE league = '2';"]);
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_picks" AS 
      SELECT id, season, "type", round, "pickNumber", (SELECT json_build_object('id', "id", 'name', "name") FROM team t WHERE t.id = "currentOwnerId") AS "currentPickHolder", (SELECT json_build_object('id', "id", 'name', "name") FROM team t WHERE t.id = "originalOwnerId") AS "originalPickOwner"
      FROM draft_pick;
        `);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_picks","SELECT id, season, \"type\", round, \"pickNumber\", (SELECT json_build_object('id', \"id\", 'name', \"name\") FROM team t WHERE t.id = \"currentOwnerId\") AS \"currentPickHolder\", (SELECT json_build_object('id', \"id\", 'name', \"name\") FROM team t WHERE t.id = \"originalOwnerId\") AS \"originalPickOwner\"\n      FROM draft_pick;"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_picks"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_picks"`);
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_minors"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_minors"`);
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_majors"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_majors"`);
    }

}
