import {MigrationInterface, QueryRunner} from "typeorm";

export class draftPickUpdateIndices1585248977951 implements MigrationInterface {
    name = 'draftPickUpdateIndices1585248977951'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_71715a4e4ab6bea1e8167d85c3"`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_71715a4e4ab6bea1e8167d85c5" ON "dev"."draft_pick" ("season", "round", "pickNumber", "type") `, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_71715a4e4ab6bea1e8167d85c5"`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_71715a4e4ab6bea1e8167d85c3" ON "dev"."draft_pick" ("season", "round", "pickNumber") `, undefined);
    }

}
