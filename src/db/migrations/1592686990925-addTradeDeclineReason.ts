import {MigrationInterface, QueryRunner} from "typeorm";

export class addTradeDeclineReason1592686990925 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade" ADD COLUMN "declinedReason" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade" DROP COLUMN "declinedReason"`);
    }

}
