import {MigrationInterface, QueryRunner} from "typeorm";

export class updateLeagueLevelEnums1591065889278 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."player_league_enum" RENAME TO "player_league_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."player_league_enum" AS ENUM('Majors', 'Minors')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."player" ALTER COLUMN "league" TYPE "player_league_enum" USING league::text::player_league_enum`)
        await queryRunner.query(`DROP TYPE "dev"."player_league_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."player_league_enum" RENAME TO "player_league_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."player_league_enum" AS ENUM('Majors', 'High Minors', 'Low Minors')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."player" ALTER COLUMN "league" TYPE "player_league_enum" USING league::text::player_league_enum`)
        await queryRunner.query(`DROP TYPE "dev"."player_league_enum_old"`, undefined);
    }

}
