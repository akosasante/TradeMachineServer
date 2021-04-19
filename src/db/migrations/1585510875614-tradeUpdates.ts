import {MigrationInterface, QueryRunner} from "typeorm";

export class tradeUpdates1585510875614 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemId" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemId" SET DATA TYPE uuid USING (uuid_generate_v4())`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemId" SET DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_cbff369d9b0f3e749d8895fbbb"`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cbff369d9b0f3e749d8895fbbc" ON "dev"."trade_item" ("tradeId", "tradeItemId", "tradeItemType", "senderId", "recipientId") `, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP CONSTRAINT "PK_1d90e81ec4d3fc587b884b55f15"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD COLUMN "id" uuid NOT NULL DEFAULT uuid_generate_v4(), ADD COLUMN "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), ADD COLUMN "dateModified" TIMESTAMP NOT NULL DEFAULT now()`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemId" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemId" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ALTER COLUMN "tradeItemId" SET DEFAULT nextval('"trade_item_tradeItemId_seq"'::regclass) ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 )`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_cbff369d9b0f3e749d8895fbbc"`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cbff369d9b0f3e749d8895fbbb" ON "dev"."trade_item" ("tradeId", "senderId", "recipientId", "playerId", "pickId") `, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD PRIMARY KEY ("tradeItemId")`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP COLUMN "id", DROP COLUMN "dateCreated", DROP COLUMN "dateModified"`, undefined);
    }

}
