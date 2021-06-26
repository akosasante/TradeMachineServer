import {MigrationInterface, QueryRunner} from "typeorm";

export class updateEntityViews1624319405552 implements MigrationInterface {
    name = 'updateEntityViews1624319405552'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_majors"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_majors" CASCADE`);
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_minors"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_minors" CASCADE`);
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_picks"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_picks" CASCADE`);
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_majors" AS 
      SELECT p.id,
             p.name,
             p.league,
             COALESCE(p."mlbTeam", p.meta ->> 'proTeamId') AS "mlbTeam",
             (SELECT json_build_object('id', "id", 'name', "name")
              FROM team t
              WHERE t.id = p."leagueTeamId") AS "ownerTeam",
             p.meta -> 'espnPlayer' -> 'player' -> 'eligibleSlots' AS "eligiblePositions",
             p.meta -> 'position' AS "mainPosition"
      FROM "dev"."player" p
      WHERE p.league::varchar = '1';
  `);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_majors","SELECT id,\n             name,\n             league,\n             COALESCE(\"mlbTeam\", meta ->> 'proTeamId') AS \"mlbTeam\",\n             (SELECT json_build_object('id', \"id\", 'name', \"name\")\n              FROM team t\n              WHERE t.id = \"leagueTeamId\") AS \"ownerTeam\",\n             meta -> 'espnPlayer' -> 'player' -> 'eligibleSlots' AS \"eligiblePositions\",\n             meta -> 'position' AS \"mainPosition\"\n      FROM player\n      WHERE player.league::varchar = '1';"]);
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_minors" AS 
      SELECT p.id,
             p.name,
             p.league,
             (SELECT json_build_object('id', "id", 'name', "name")
              FROM team t
              WHERE t.id = p."leagueTeamId")                          AS "ownerTeam",
             p.meta -> 'minorLeaguePlayerFromSheet' ->> 'mlbTeam'     AS "minorTeam",
             p.meta -> 'minorLeaguePlayerFromSheet' ->> 'position'    as "position",
             p.meta -> 'minorLeaguePlayerFromSheet' ->> 'leagueLevel' as "minorLeagueLevel"
      FROM "dev"."player" p
      WHERE p.league::varchar = '2';
  `);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_minors","SELECT id,\n             name,\n             league,\n             (SELECT json_build_object('id', \"id\", 'name', \"name\")\n              FROM team t\n              WHERE t.id = \"leagueTeamId\")                          AS \"ownerTeam\",\n             meta -> 'minorLeaguePlayerFromSheet' ->> 'mlbTeam'     AS \"minorTeam\",\n             meta -> 'minorLeaguePlayerFromSheet' ->> 'position'    as \"position\",\n             meta -> 'minorLeaguePlayerFromSheet' ->> 'leagueLevel' as \"minorLeagueLevel\"\n      FROM player\n      WHERE player.league::varchar = '2';"]);
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_picks" AS 
      SELECT dp.id,
             dp.season,
             dp."type",
             dp.round,
             dp."pickNumber",
             (SELECT json_build_object('id', "id", 'name', "name")
              FROM team t
              WHERE t.id = dp."currentOwnerId") AS "currentPickHolder",
             (SELECT json_build_object('id', "id", 'name', "name")
              FROM team t
              WHERE t.id = dp."originalOwnerId") AS "originalPickOwner"
      FROM draft_pick dp;
  `);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_picks","SELECT id,\n             season,\n             \"type\",\n             round,\n             \"pickNumber\",\n             (SELECT json_build_object('id', \"id\", 'name', \"name\")\n              FROM team t\n              WHERE t.id = \"currentOwnerId\") AS \"currentPickHolder\",\n             (SELECT json_build_object('id', \"id\", 'name', \"name\")\n              FROM team t\n              WHERE t.id = \"originalOwnerId\") AS \"originalPickOwner\"\n      FROM draft_pick;"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_picks"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_picks" CASCADE`);
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_minors"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_minors" CASCADE`);
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_majors"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_majors" CASCADE`);
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_picks" AS SELECT id, season, "type", round, "pickNumber", (SELECT json_build_object('id', "id", 'name', "name") FROM team t WHERE t.id = "currentOwnerId") AS "currentPickHolder", (SELECT json_build_object('id', "id", 'name', "name") FROM team t WHERE t.id = "originalOwnerId") AS "originalPickOwner"
      FROM draft_pick;`);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_picks","SELECT id, season, \"type\", round, \"pickNumber\", (SELECT json_build_object('id', \"id\", 'name', \"name\") FROM team t WHERE t.id = \"currentOwnerId\") AS \"currentPickHolder\", (SELECT json_build_object('id', \"id\", 'name', \"name\") FROM team t WHERE t.id = \"originalOwnerId\") AS \"originalPickOwner\"\n      FROM draft_pick;"]);
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_majors" AS SELECT id, name, league, COALESCE("mlbTeam", meta->>'proTeamId') AS "mlbTeam", (SELECT json_build_object('id', "id", 'name', "name") FROM team t WHERE t.id = "leagueTeamId") AS "ownerTeam", meta->'espnPlayer'->'player'->'eligibleSlots' AS "eligiblePositions", meta->'position' AS "mainPosition"
        FROM player
        WHERE league = '1';`);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_majors","SELECT id, name, league, COALESCE(\"mlbTeam\", meta->>'proTeamId') AS \"mlbTeam\", (SELECT json_build_object('id', \"id\", 'name', \"name\") FROM team t WHERE t.id = \"leagueTeamId\") AS \"ownerTeam\", meta->'espnPlayer'->'player'->'eligibleSlots' AS \"eligiblePositions\", meta->'position' AS \"mainPosition\"\n        FROM player\n        WHERE league = '1';"]);
    }

}
