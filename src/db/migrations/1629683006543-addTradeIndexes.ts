import {MigrationInterface, QueryRunner} from "typeorm";

export class addTradeIndexes1629683006543 implements MigrationInterface {
    name = 'addTradeIndexes1629683006543'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_4790898869f46e4f7714c23f4e" ON "dev"."trade_participant" ("participantType") `);
        await queryRunner.query(`CREATE INDEX "IDX_6f42978de8c286663f97f12c9d" ON "dev"."trade_participant" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_33ece5157bae9642f83f4e69e6" ON "dev"."trade" ("declinedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_7410fa0ef846786168a48f8309" ON "dev"."trade_item" ("tradeItemType") `);
        await queryRunner.query(`CREATE INDEX "IDX_1abdf634a91dc15221fecbd253" ON "dev"."trade_item" ("recipientId") `);
        await queryRunner.query(`CREATE INDEX "IDX_93c36c896adc55ffa2fde08807" ON "dev"."trade_item" ("senderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5183edace8d48f41e21706f3de" ON "dev"."trade_item" ("senderId", "recipientId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_5183edace8d48f41e21706f3de"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_93c36c896adc55ffa2fde08807"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_1abdf634a91dc15221fecbd253"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_7410fa0ef846786168a48f8309"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_33ece5157bae9642f83f4e69e6"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_6f42978de8c286663f97f12c9d"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_4790898869f46e4f7714c23f4e"`);
    }

}
