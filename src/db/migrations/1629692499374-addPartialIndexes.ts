import {MigrationInterface, QueryRunner} from "typeorm";

export class addPartialIndexes1629692499374 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "trade_creator_index" ON "dev"."trade_participant" ("participantType") WHERE "participantType" = '1'`);
        await queryRunner.query(`CREATE INDEX "trade_recipient_index" ON "dev"."trade_participant" ("participantType") WHERE "participantType" = '2'`);
        await queryRunner.query(`CREATE INDEX "player_trade_item_index" ON "dev"."trade_item" ("tradeItemType") WHERE "tradeItemType" = '1'`);
        await queryRunner.query(`CREATE INDEX "pick_trade_item_index" ON "dev"."trade_item" ("tradeItemType") WHERE "tradeItemType" = '2'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."trade_creator_index"`);
        await queryRunner.query(`DROP INDEX "dev"."trade_recipient_index"`);
        await queryRunner.query(`DROP INDEX "dev"."player_trade_item_index"`);
        await queryRunner.query(`DROP INDEX "dev"."pick_trade_item_index"`);

    }

}
