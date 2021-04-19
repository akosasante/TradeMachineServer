import {MigrationInterface, QueryRunner} from "typeorm";

export class cacheSynch1610590777794 implements MigrationInterface {
    name = 'cacheSynch1610590777794'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP COLUMN "test"`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP COLUMN "test_uuid"`);
        await queryRunner.query(`CREATE TABLE "dev"."query-result-cache" ("id" SERIAL NOT NULL, "identifier" character varying, "time" bigint NOT NULL, "duration" integer NOT NULL, "query" text NOT NULL, "result" text NOT NULL, CONSTRAINT "PK_929433fa4533ebffc26ab9ad509" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "dev"."query-result-cache"`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD "test_uuid" uuid NOT NULL DEFAULT uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD "test" character varying NOT NULL DEFAULT ''`);
    }

}
