import {MigrationInterface, QueryRunner} from "typeorm";

export class updateUserStatusEnums1593236379691 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."user_status_enum" RENAME TO "user_status_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."user_status_enum" AS ENUM('1', '2')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "status" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "status" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."user" SET "status" = '2' WHERE "status" = 'inactive'`)
        await queryRunner.query(`UPDATE "dev"."user" SET "status" = '1' WHERE "status" = 'active'`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "status" TYPE "user_status_enum" USING status::text::user_status_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "status" SET DEFAULT '1'`)
        await queryRunner.query(`DROP TYPE "dev"."user_status_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."user_status_enum" RENAME TO "user_status_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."user_status_enum" AS ENUM('active', 'inactive')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "status" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "status" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."user" SET "status" = 'active' WHERE "status" = '1'`)
        await queryRunner.query(`UPDATE "dev"."user" SET "status" = 'inactive' WHERE "status" = '2'`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "status" TYPE "user_status_enum" USING status::text::user_status_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "status" SET DEFAULT 'active'`)
        await queryRunner.query(`DROP TYPE "dev"."user_status_enum_old"`, undefined);
    }

}
