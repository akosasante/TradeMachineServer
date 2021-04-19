import {MigrationInterface, QueryRunner} from "typeorm";

export class adddeclinedByIdField1592694380902 implements MigrationInterface {
    name = 'adddeclinedByIdField1592694380902'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."trade" ADD "declinedById" uuid`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."trade" DROP COLUMN "declinedById"`, undefined);
    }
}
