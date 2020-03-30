import {MigrationInterface, QueryRunner} from "typeorm";

export class tradeUpdatesPt41585530009645 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ADD COLUMN "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), ADD COLUMN "dateModified" TIMESTAMP NOT NULL DEFAULT now()`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" DROP COLUMN "dateCreated", DROP COLUMN "dateModified"`, undefined);
    }

}
