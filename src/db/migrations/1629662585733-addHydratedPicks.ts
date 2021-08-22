import {MigrationInterface, QueryRunner} from "typeorm";

export class addHydratedPicks1629662585733 implements MigrationInterface {
    name = 'addHydratedPicks1629662585733'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE VIEW "dev"."hydrated_picks" AS 
        SELECT id,
               season,
               "type",
               round,
               "pickNumber",
               (SELECT json_build_object('id', "id", 'name', "name")
                FROM dev.team t
                WHERE t.id = "currentOwnerId")  AS "currentPickHolder",
               (SELECT json_build_object('id', "id", 'name', "name")
                FROM dev.team t
                WHERE t.id = "originalOwnerId") AS "originalPickOwner"
        FROM dev.draft_pick;
    `);
        await queryRunner.query(`INSERT INTO "dev"."typeorm_metadata"("type", "schema", "name", "value") VALUES ($1, $2, $3, $4)`, ["VIEW","dev","hydrated_picks","SELECT id,\n               season,\n               \"type\",\n               round,\n               \"pickNumber\",\n               (SELECT json_build_object('id', \"id\", 'name', \"name\")\n                FROM dev.team t\n                WHERE t.id = \"currentOwnerId\")  AS \"currentPickHolder\",\n               (SELECT json_build_object('id', \"id\", 'name', \"name\")\n                FROM dev.team t\n                WHERE t.id = \"originalOwnerId\") AS \"originalPickOwner\"\n        FROM dev.draft_pick;"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "dev"."typeorm_metadata" WHERE "type" = 'VIEW' AND "schema" = $1 AND "name" = $2`, ["dev","hydrated_picks"]);
        await queryRunner.query(`DROP VIEW "dev"."hydrated_picks"`);
    }

}
