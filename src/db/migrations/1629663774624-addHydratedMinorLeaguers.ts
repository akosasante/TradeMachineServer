import {MigrationInterface, QueryRunner} from "typeorm";

export class addHydratedMinorLeaguers1629663774624 implements MigrationInterface {
    name = 'addHydratedMinorLeaguers1629663774624'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_minors" AS 
        SELECT id,
               name,
               league,
               (SELECT json_build_object('id', "id", 'name', "name")
                FROM dev.team t
                WHERE t.id = "leagueTeamId")                          AS "ownerTeam",
               meta -> 'minorLeaguePlayerFromSheet' ->> 'mlbTeam'     AS "minorTeam",
               meta -> 'minorLeaguePlayerFromSheet' ->> 'position'    as "position",
               meta -> 'minorLeaguePlayerFromSheet' ->> 'leagueLevel' as "minorLeagueLevel"
        FROM dev.player
        WHERE dev.player.league::text = '2';
    `);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_minors","SELECT id,\n               name,\n               league,\n               (SELECT json_build_object('id', \"id\", 'name', \"name\")\n                FROM dev.team t\n                WHERE t.id = \"leagueTeamId\")                          AS \"ownerTeam\",\n               meta -> 'minorLeaguePlayerFromSheet' ->> 'mlbTeam'     AS \"minorTeam\",\n               meta -> 'minorLeaguePlayerFromSheet' ->> 'position'    as \"position\",\n               meta -> 'minorLeaguePlayerFromSheet' ->> 'leagueLevel' as \"minorLeagueLevel\"\n        FROM dev.player\n        WHERE dev.player.league::text = '2';"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_minors"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_minors"`);
    }

}
