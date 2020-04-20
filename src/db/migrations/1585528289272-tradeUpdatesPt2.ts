import {MigrationInterface, QueryRunner} from "typeorm";

export class tradeUpdatesPt21585528289272 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD PRIMARY KEY ("id")`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP COLUMN "pickId", DROP COLUMN "playerId"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD COLUMN "pickId" uuid, ADD COLUMN "playerId" uuid`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP CONSTRAINT "trade_item_pkey"`, undefined);
    }

}
