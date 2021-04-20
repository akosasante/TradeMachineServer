import {MigrationInterface, QueryRunner} from "typeorm";

export class updatePlayerEnums1593283821017 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."player_league_enum" RENAME TO "player_league_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."player_league_enum" AS ENUM('1', '2')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."player" ALTER COLUMN "league" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."player" SET "league" = '2' WHERE "league" = 'Minors'`)
        await queryRunner.query(`UPDATE "dev"."player" SET "league" = '1' WHERE "league" = 'Majors'`)
        await queryRunner.query(`ALTER TABLE "dev"."player" ALTER COLUMN "league" TYPE "player_league_enum" USING league::text::player_league_enum`)
        await queryRunner.query(`DROP TYPE "dev"."player_league_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."player_league_enum" RENAME TO "player_league_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."player_league_enum" AS ENUM('Majors', 'Minors')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."player" ALTER COLUMN "league" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."player" SET "league" = 'Minors' WHERE "league" = '2'`)
        await queryRunner.query(`UPDATE "dev"."player" SET "league" = 'Majors' WHERE "league" = '1'`)
        await queryRunner.query(`ALTER TABLE "dev"."player" ALTER COLUMN "league" TYPE "player_league_enum" USING league::text::player_league_enum`)
        await queryRunner.query(`DROP TYPE "dev"."player_league_enum_old"`, undefined);
    }

}
