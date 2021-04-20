import {MigrationInterface, QueryRunner} from "typeorm";

export class addCommissionerUserRole1597180194878 implements MigrationInterface {
    name = 'addCommissionerUserRole1597180194878'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "dev"."user_role_enum" RENAME TO "user_role_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."user_role_enum" AS ENUM('1', '2', '3')`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" TYPE CHARACTER VARYING`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" TYPE "user_role_enum" USING role::text::user_role_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" SET DEFAULT '2'`)
        await queryRunner.query(`DROP TYPE "dev"."user_role_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "dev"."user_role_enum" RENAME TO "user_role_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."user_role_enum" AS ENUM('1', '2')`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" TYPE CHARACTER VARYING`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" TYPE "user_role_enum" USING role::text::user_role_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."user" ALTER COLUMN "role" SET DEFAULT '2'`)
        await queryRunner.query(`DROP TYPE "dev"."user_role_enum_old"`, undefined);
    }

}
