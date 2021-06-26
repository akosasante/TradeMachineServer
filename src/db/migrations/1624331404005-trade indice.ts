import {MigrationInterface, QueryRunner} from "typeorm";

export class tradeIndice1624331404005 implements MigrationInterface {
    name = 'tradeIndice1624331404005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_4790898869f46e4f7714c23f4e" ON "dev"."trade_participant" ("participantType") `);
        await queryRunner.query(`CREATE INDEX "IDX_6f42978de8c286663f97f12c9d" ON "dev"."trade_participant" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d6f89270d7917635f027c0244d" ON "dev"."trade" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_33ece5157bae9642f83f4e69e6" ON "dev"."trade" ("declinedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_1d90e81ec4d3fc587b884b55f1" ON "dev"."trade_item" ("tradeItemId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7410fa0ef846786168a48f8309" ON "dev"."trade_item" ("tradeItemType") `);
        await queryRunner.query(`CREATE INDEX "IDX_93c36c896adc55ffa2fde08807" ON "dev"."trade_item" ("senderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1abdf634a91dc15221fecbd253" ON "dev"."trade_item" ("recipientId") `);
        await queryRunner.query(`CREATE INDEX "IDX_edbfdecf43bec56ee160c9ba6b" ON "dev"."draft_pick" ("currentOwnerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e448065a1f32514925e8045b6" ON "dev"."draft_pick" ("originalOwnerId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_5e448065a1f32514925e8045b6"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_edbfdecf43bec56ee160c9ba6b"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_1abdf634a91dc15221fecbd253"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_93c36c896adc55ffa2fde08807"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_7410fa0ef846786168a48f8309"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_1d90e81ec4d3fc587b884b55f1"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_33ece5157bae9642f83f4e69e6"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_d6f89270d7917635f027c0244d"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_6f42978de8c286663f97f12c9d"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_4790898869f46e4f7714c23f4e"`);
    }

}
