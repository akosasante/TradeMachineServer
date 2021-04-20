import {MigrationInterface, QueryRunner} from "typeorm";

export class playerMetaToJsonbType1587498748374 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."player" ALTER COLUMN "meta" SET DATA TYPE jsonb USING meta::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."player" ALTER COLUMN "meta" SET DATA TYPE json`);
    }

}
