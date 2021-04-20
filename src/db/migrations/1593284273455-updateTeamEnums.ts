import {MigrationInterface, QueryRunner} from "typeorm";

export class updateTeamEnums1593284273455 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."team_status_enum" RENAME TO "team_status_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."team_status_enum" AS ENUM('1', '2')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."team" ALTER COLUMN "status" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."team" ALTER COLUMN "status" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."team" SET "status" = '2' WHERE "status" = 'inactive'`)
        await queryRunner.query(`UPDATE "dev"."team" SET "status" = '1' WHERE "status" = 'active'`)
        await queryRunner.query(`ALTER TABLE "dev"."team" ALTER COLUMN "status" TYPE "team_status_enum" USING status::text::team_status_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."team" ALTER COLUMN "status" SET DEFAULT '2'`)
        await queryRunner.query(`DROP TYPE "dev"."team_status_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."team_status_enum" RENAME TO "team_status_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."team_status_enum" AS ENUM('active', 'inactive')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."team" ALTER COLUMN "status" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."team" ALTER COLUMN "status" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."team" SET "status" = 'active' WHERE "status" = '1'`)
        await queryRunner.query(`UPDATE "dev"."team" SET "status" = 'inactive' WHERE "status" = '2'`)
        await queryRunner.query(`ALTER TABLE "dev"."team" ALTER COLUMN "status" TYPE "team_status_enum" USING status::text::team_status_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."team" ALTER COLUMN "status" SET DEFAULT 'inactive'`)
        await queryRunner.query(`DROP TYPE "dev"."team_status_enum_old"`, undefined);
    }

}
