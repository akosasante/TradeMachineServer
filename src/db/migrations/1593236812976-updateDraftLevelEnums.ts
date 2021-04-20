import {MigrationInterface, QueryRunner} from "typeorm";

export class updateDraftLevelEnums1593236812976 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."draft_pick_type_enum" RENAME TO "draft_pick_type_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."draft_pick_type_enum" AS ENUM('1', '2', '3')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "type" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."draft_pick" SET "type" = '3' WHERE "type" = 'Low Minors'`)
        await queryRunner.query(`UPDATE "dev"."draft_pick" SET "type" = '2' WHERE "type" = 'High Minors'`)
        await queryRunner.query(`UPDATE "dev"."draft_pick" SET "type" = '1' WHERE "type" = 'Majors'`)
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "type" TYPE "draft_pick_type_enum" USING type::text::draft_pick_type_enum`)
        await queryRunner.query(`DROP TYPE "dev"."draft_pick_type_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."draft_pick_type_enum" RENAME TO "draft_pick_type_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."draft_pick_type_enum" AS ENUM('Majors', 'High Minors', 'Low Minors')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "type" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."draft_pick" SET "type" = 'Low Minors' WHERE "type" = '3'`)
        await queryRunner.query(`UPDATE "dev"."draft_pick" SET "type" = 'High Minors' WHERE "type" = '2'`)
        await queryRunner.query(`UPDATE "dev"."draft_pick" SET "type" = 'Majors' WHERE "type" = '1'`)
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "type" TYPE "draft_pick_type_enum" USING type::text::draft_pick_type_enum`)
        await queryRunner.query(`DROP TYPE "dev"."draft_pick_type_enum_old"`, undefined);
    }

}
