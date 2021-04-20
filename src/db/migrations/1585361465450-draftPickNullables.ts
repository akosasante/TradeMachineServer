import {MigrationInterface, QueryRunner} from "typeorm";

export class draftPickNullables1585361465450 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "pickNumber" SET NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "season" SET NOT NULL`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "pickNumber" DROP NOT NULL`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ALTER COLUMN "season" DROP NOT NULL`, undefined);
    }

}
