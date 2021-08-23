import {MigrationInterface, QueryRunner} from "typeorm";

export class addDraftPickIndexes1629681198782 implements MigrationInterface {
    name = 'addDraftPickIndexes1629681198782'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_0de9414ff65ab246290e2793ac" ON "dev"."draft_pick" ("currentOwnerId", "originalOwnerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e448065a1f32514925e8045b6" ON "dev"."draft_pick" ("originalOwnerId") `);
        await queryRunner.query(`CREATE INDEX "IDX_edbfdecf43bec56ee160c9ba6b" ON "dev"."draft_pick" ("currentOwnerId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "dev"."IDX_edbfdecf43bec56ee160c9ba6b"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_5e448065a1f32514925e8045b6"`);
        await queryRunner.query(`DROP INDEX "dev"."IDX_0de9414ff65ab246290e2793ac"`);
    }

}
