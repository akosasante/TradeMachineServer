import {MigrationInterface, QueryRunner} from "typeorm";

export class updateDraftIndices1586138929006 implements MigrationInterface {
    name = 'updateDraftIndices1586138929006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_71715a4e4ab6bea1e8167d85c5"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "pickNumber" DROP NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "round" SET DATA TYPE NUMERIC(3, 1)`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_71715a4e4ab6bea1e8167d84c5" ON "dev"."draft_pick" ("type", "season", "round", "originalOwnerId")`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_71715a4e4ab6bea1e8167d84c5"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "round" SET DATA TYPE INTEGER`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "pickNumber" SET NOT NULL`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_71715a4e4ab6bea1e8167d85c5" ON "dev"."draft_pick" ("season", "round", "pickNumber", "type") `, undefined);
    }

}
