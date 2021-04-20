import {MigrationInterface, QueryRunner} from "typeorm";

export class addAcceptedOnColumn1604168481044 implements MigrationInterface {
    name = 'addAcceptedOnColumn1604168481044'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_9612a91c314e8c1914ba0388ed"`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP COLUMN "downtimeStartDate"`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP COLUMN "downtimeEndDate"`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP COLUMN "downtimeReason"`);
        await queryRunner.query(`ALTER TABLE "dev"."trade" ADD "acceptedOnDate" TIMESTAMP`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_e052cf9b5b061404e7d9757a5f"`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemId" DROP DEFAULT`);
        await queryRunner.query(`DROP SEQUENCE "dev"."trade_item_tradeItemId_seq"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e052cf9b5b061404e7d9757a5f" ON "dev"."trade_item" ("tradeId", "tradeItemId", "tradeItemType", "senderId", "recipientId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_e052cf9b5b061404e7d9757a5f"`);
        await queryRunner.query(`CREATE SEQUENCE "dev"."trade_item_tradeItemId_seq" OWNED BY "dev"."trade_item"."tradeItemId"`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemId" SET DEFAULT nextval('dev.trade_item_tradeItemId_seq')`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e052cf9b5b061404e7d9757a5f" ON "dev"."trade_item" ("tradeItemId", "tradeItemType", "tradeId", "senderId", "recipientId") `);
        await queryRunner.query(`ALTER TABLE "dev"."trade" DROP COLUMN "acceptedOnDate"`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD "downtimeReason" character varying`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD "downtimeEndDate" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD "downtimeStartDate" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_9612a91c314e8c1914ba0388ed" ON "dev"."settings" ("modifiedById", "downtimeStartDate", "downtimeEndDate", "downtimeReason") `);
    }

}
