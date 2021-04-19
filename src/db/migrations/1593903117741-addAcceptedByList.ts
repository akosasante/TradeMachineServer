import {MigrationInterface, QueryRunner} from "typeorm";

export class addAcceptedByList1593903117741 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade" ADD "acceptedBy" jsonb`)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade" DROP COLUMN "acceptedBy"`)
    }
}
