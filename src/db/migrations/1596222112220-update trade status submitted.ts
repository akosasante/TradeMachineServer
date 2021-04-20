import {MigrationInterface, QueryRunner} from "typeorm";

export class updateTradeStatusSubmitted1596222112220 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."trade_status_enum" RENAME TO "trade_status_enum_old"`, undefined)
        await queryRunner.query(`CREATE TYPE "dev"."trade_status_enum" AS ENUM('1', '2', '3', '4', '5', '6')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade" ALTER COLUMN "status" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."trade" ALTER COLUMN "status" TYPE CHARACTER VARYING`)
        await queryRunner.query(`ALTER TABLE "dev"."trade" ALTER COLUMN "status" TYPE "trade_status_enum" USING "status"::text::trade_status_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."trade" ALTER COLUMN "status" SET DEFAULT '1'`)
        await queryRunner.query(`DROP TYPE "dev"."trade_status_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."trade_status_enum" RENAME TO "trade_status_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."trade_status_enum" AS ENUM('1', '2', '3', '4', '5')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade" ALTER COLUMN "status" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."trade" ALTER COLUMN "status" TYPE CHARACTER VARYING`)
        await queryRunner.query(`ALTER TABLE "dev"."trade" ALTER COLUMN "status" TYPE "trade_status_enum" USING  "status"::text::trade_status_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."trade" ALTER COLUMN "status" SET DEFAULT '1'`)
        await queryRunner.query(`DROP TYPE "dev"."trade_status_enum_old"`, undefined);
    }

}
