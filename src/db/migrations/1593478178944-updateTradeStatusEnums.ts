import {MigrationInterface, QueryRunner} from "typeorm";

export class updateTradeStatusEnums1593478178944 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."trade_status_enum" RENAME TO "trade_status_enum_old"`, undefined)
        await queryRunner.query(`CREATE TYPE "dev"."trade_status_enum" AS ENUM('1', '2', '3', '4', '5')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade"
            ALTER COLUMN "status" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."trade"
            ALTER COLUMN "status" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."trade"
                                 SET "status" = '5'
                                 WHERE "status" = '4'`)
        await queryRunner.query(`UPDATE "dev"."trade"
                                 SET "status" = '4'
                                 WHERE "status" = '3'`)
        await queryRunner.query(`UPDATE "dev"."trade"
                                 SET "status" = '3'
                                 WHERE "status" = '2'`)
        await queryRunner.query(`UPDATE "dev"."trade"
                                 SET "status" = '2'
                                 WHERE "status" = '1'`)
        await queryRunner.query(`UPDATE "dev"."trade"
                                 SET "status" = '1'
                                 WHERE "status" = '0'`)
        await queryRunner.query(`ALTER TABLE "dev"."trade"
            ALTER COLUMN "status" TYPE "trade_status_enum" USING "status"::text::trade_status_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."trade"
            ALTER COLUMN "status" SET DEFAULT '1'`)
        await queryRunner.query(`DROP TYPE "dev"."trade_status_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."trade_status_enum" RENAME TO "trade_status_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."trade_status_enum" AS ENUM('0', '1', '2', '3', '4')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade"
            ALTER COLUMN "status" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."trade"
            ALTER COLUMN "status" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."trade"
                                 SET "status" = '0'
                                 WHERE "status" = '1'`)
        await queryRunner.query(`UPDATE "dev"."trade"
                                 SET "status" = '1'
                                 WHERE "status" = '2'`)
        await queryRunner.query(`UPDATE "dev"."trade"
                                 SET "status" = '2'
                                 WHERE "status" = '3'`)
        await queryRunner.query(`UPDATE "dev"."trade"
                                 SET "status" = '3'
                                 WHERE "status" = '4'`)
        await queryRunner.query(`UPDATE "dev"."trade"
                                 SET "status" = '4'
                                 WHERE "status" = '5'`)
        await queryRunner.query(`ALTER TABLE "dev"."trade"
            ALTER COLUMN "status" TYPE "trade_status_enum" USING "status"::text::trade_status_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."trade"
            ALTER COLUMN "status" SET DEFAULT '0'`)
        await queryRunner.query(`DROP TYPE "dev"."trade_status_enum_old"`, undefined);
    }

}
