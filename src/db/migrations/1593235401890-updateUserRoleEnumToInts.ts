import {MigrationInterface, QueryRunner} from "typeorm";

export class updateUserRoleEnumToInts1591065889278 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."user_role_enum" RENAME TO "user_role_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."user_role_enum" AS ENUM('1', '2')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."user" SET "role" = '2' WHERE "role" = 'owner'`)
        await queryRunner.query(`UPDATE "dev"."user" SET "role" = '1' WHERE "role" = 'admin'`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" TYPE "user_role_enum" USING role::text::user_role_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" SET DEFAULT '2'`)
        await queryRunner.query(`DROP TYPE "dev"."user_role_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."user_role_enum" RENAME TO "user_role_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."user_role_enum" AS ENUM('admin', 'owner')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."user" SET "role" = 'admin' WHERE "role" = '1'`)
        await queryRunner.query(`UPDATE "dev"."user" SET "role" = 'owner' WHERE "role" = '2'`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" TYPE "user_role_enum" USING role::text::user_role_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" SET DEFAULT 'owner'`)
        await queryRunner.query(`DROP TYPE "dev"."user_role_enum_old"`, undefined);
    }
}
