import {MigrationInterface, QueryRunner} from "typeorm";

export class addHydratedMajorLeaguers1629662831613 implements MigrationInterface {
    name = 'addHydratedMajorLeaguers1629662831613'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_majors" AS 
        SELECT id,
               name,
               league,
               COALESCE("mlbTeam", meta ->> 'proTeamId')           AS "mlbTeam",
               (SELECT json_build_object('id', "id", 'name', "name")
                FROM dev.team t
                WHERE t.id = "leagueTeamId")                       AS "ownerTeam",
               meta -> 'espnPlayer' -> 'player' -> 'eligibleSlots' AS "eligiblePositions",
               meta -> 'position'                                  AS "mainPosition"
        FROM dev.player
        WHERE dev.player.league::text = '1';
    `);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_majors","SELECT id,\n               name,\n               league,\n               COALESCE(\"mlbTeam\", meta ->> 'proTeamId')           AS \"mlbTeam\",\n               (SELECT json_build_object('id', \"id\", 'name', \"name\")\n                FROM dev.team t\n                WHERE t.id = \"leagueTeamId\")                       AS \"ownerTeam\",\n               meta -> 'espnPlayer' -> 'player' -> 'eligibleSlots' AS \"eligiblePositions\",\n               meta -> 'position'                                  AS \"mainPosition\"\n        FROM dev.player\n        WHERE dev.player.league::text = '1';"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_majors"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_majors"`);
    }

}
