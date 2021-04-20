import {MigrationInterface, QueryRunner} from "typeorm";

export class updateTradeItemEnums1593284552934 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."trade_item_tradeitemtype_enum" RENAME TO "trade_item_tradeitemtype_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."trade_item_tradeitemtype_enum" AS ENUM('1', '2')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemType" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemType" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."trade_item" SET "tradeItemType" = '2' WHERE "tradeItemType" = 'Pick'`)
        await queryRunner.query(`UPDATE "dev"."trade_item" SET "tradeItemType" = '1' WHERE "tradeItemType" = 'Player'`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemType" TYPE "trade_item_tradeitemtype_enum" USING "tradeItemType"::text::trade_item_tradeitemtype_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemType" SET DEFAULT '1'`)
        await queryRunner.query(`DROP TYPE "dev"."trade_item_tradeitemtype_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."trade_item_tradeitemtype_enum" RENAME TO "trade_item_tradeitemtype_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."trade_item_tradeitemtype_enum" AS ENUM('Player', 'Pick')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemType" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemType" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."trade_item" SET "tradeItemType" = 'Player' WHERE "tradeItemType" = '1'`)
        await queryRunner.query(`UPDATE "dev"."trade_item" SET "tradeItemType" = 'Pick' WHERE "tradeItemType" = '2'`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemType" TYPE "trade_item_tradeitemtype_enum" USING  "tradeItemType"::text::trade_item_tradeitemtype_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemType" SET DEFAULT 'Player'`)
        await queryRunner.query(`DROP TYPE "dev"."trade_item_tradeitemtype_enum_old"`, undefined);
    }

}
