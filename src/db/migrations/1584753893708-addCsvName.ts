import {MigrationInterface, QueryRunner} from "typeorm";

export class addCsvName1584753893708 implements MigrationInterface {
    name = 'addCsvName1584753893708'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."user" ADD "csvName" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."user" DROP COLUMN "csvName"`);
    }

}
