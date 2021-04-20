import {MigrationInterface, QueryRunner} from "typeorm";

export class connectEmailToTrades1599167894989 implements MigrationInterface {
    name = 'connectEmailToTrades1599167894989'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6ac"`);
        await queryRunner.query(`ALTER TABLE "dev"."user" DROP CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6bd"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_40e3ad1d41d05dda60e9zZba22dd"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_945a167cdde65d4fb6bf5508d9f75584"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_cbff369d9b0f3e749d8895fbbc"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_40e3ad1d41d05dda60e9ba77ee"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_40e3ad1d41d05dda60e1aa77ee"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_40e3ad1d41d05dda60e9ba76de"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_71715a4e4ab6bea1e8167d84c5"`);
        await queryRunner.query(`CREATE TABLE "dev"."scheduled_downtime" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP NOT NULL, "cancelledDate" TIMESTAMP, "reason" character varying, CONSTRAINT "PK_90d86d54ed0fb02944c81f17dbc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP COLUMN "downtime"`);
        await queryRunner.query(`ALTER TABLE "dev"."email" ADD "tradeId" uuid`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD "downtime" jsonb`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD "downtimeStartDate" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD "downtimeEndDate" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD "downtimeReason" character varying`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "participantType" SET DEFAULT '2'`);
        await queryRunner.query(`ALTER TABLE "dev"."email" ALTER COLUMN "status" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dev"."team" ADD CONSTRAINT "UQ_4f8b73a54933f9eab5177b90362" UNIQUE ("espnId")`);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "round" TYPE numeric`);
        await queryRunner.query(`CREATE INDEX "IDX_7d64d8e03978e61c58c436ec31" ON "dev"."email" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e052cf9b5b061404e7d9757a5f" ON "dev"."trade_item" ("tradeId", "tradeItemId", "tradeItemType", "senderId", "recipientId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cb5f64b730072c78ba13d5db95" ON "dev"."settings" ("modifiedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_032a9a86a6ea1ccd874a452f62" ON "dev"."settings" ("downtime", "modifiedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_3fa40f2df01d35d0bbed8264ca" ON "dev"."settings" ("tradeWindowStart", "tradeWindowEnd", "modifiedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_9612a91c314e8c1914ba0388ed" ON "dev"."settings" ("downtimeStartDate", "downtimeEndDate", "downtimeReason", "modifiedById") `);
        await queryRunner.query(`ALTER TABLE "dev"."player" ADD CONSTRAINT "UQ_b3fd08fd2ba540e6fc2b6946e2c" UNIQUE ("name", "playerDataId")`);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ADD CONSTRAINT "UQ_b0ee29a2eed55b5c4739873e3cd" UNIQUE ("type", "season", "round", "originalOwnerId")`);
        await queryRunner.query(`ALTER TABLE "dev"."email" ADD CONSTRAINT "FK_9140a2b1ba9cdc4e9c273f0eb21" FOREIGN KEY ("tradeId") REFERENCES "dev"."trade"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD CONSTRAINT "FK_cb5f64b730072c78ba13d5db952" FOREIGN KEY ("modifiedById") REFERENCES "dev"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dev"."user" ADD CONSTRAINT "FK_77f62757967de516e50ff134e35" FOREIGN KEY ("teamId") REFERENCES "dev"."team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."user" DROP CONSTRAINT "FK_77f62757967de516e50ff134e35"`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP CONSTRAINT "FK_cb5f64b730072c78ba13d5db952"`);
        await queryRunner.query(`ALTER TABLE "dev"."email" DROP CONSTRAINT "FK_9140a2b1ba9cdc4e9c273f0eb21"`);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" DROP CONSTRAINT "UQ_b0ee29a2eed55b5c4739873e3cd"`);
        await queryRunner.query(`ALTER TABLE "dev"."player" DROP CONSTRAINT "UQ_b3fd08fd2ba540e6fc2b6946e2c"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_9612a91c314e8c1914ba0388ed"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_3fa40f2df01d35d0bbed8264ca"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_032a9a86a6ea1ccd874a452f62"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_cb5f64b730072c78ba13d5db95"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_e052cf9b5b061404e7d9757a5f"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_7d64d8e03978e61c58c436ec31"`);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "round" TYPE numeric(3,1)`);
        await queryRunner.query(`ALTER TABLE "dev"."team" DROP CONSTRAINT "UQ_4f8b73a54933f9eab5177b90362"`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP COLUMN "tradeItemId"`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD "tradeItemId" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "dev"."email" ALTER COLUMN "status" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "participantType" SET DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP COLUMN "downtimeReason"`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP COLUMN "downtimeEndDate"`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP COLUMN "downtimeStartDate"`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" DROP COLUMN "downtime"`);
        await queryRunner.query(`ALTER TABLE "dev"."email" DROP COLUMN "tradeId"`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD "downtime" jsonb`);
        await queryRunner.query(`DROP TABLE "dev"."scheduled_downtime"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_71715a4e4ab6bea1e8167d84c5" ON "dev"."draft_pick" ("round", "season", "type", "originalOwnerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_40e3ad1d41d05dda60e9ba76de" ON "dev"."settings" ("tradeWindowStart", "tradeWindowEnd", "modifiedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_40e3ad1d41d05dda60e1aa77ee" ON "dev"."settings" ("modifiedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_40e3ad1d41d05dda60e9ba77ee" ON "dev"."settings" ("modifiedById", "downtime") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cbff369d9b0f3e749d8895fbbc" ON "dev"."trade_item" ("tradeItemId", "tradeItemType", "tradeId", "senderId", "recipientId") `);
        await queryRunner.query(`CREATE INDEX "IDX_945a167cdde65d4fb6bf5508d9f75584" ON "dev"."email" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_40e3ad1d41d05dda60e9zZba22dd" ON "dev"."player" ("name", "playerDataId") `);
        await queryRunner.query(`ALTER TABLE "dev"."user" ADD CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6bd" FOREIGN KEY ("teamId", "currentOwnerId") REFERENCES "dev"."team"("id","id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dev"."settings" ADD CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6ac" FOREIGN KEY ("modifiedById") REFERENCES "dev"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
