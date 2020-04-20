import {MigrationInterface, QueryRunner} from "typeorm";

export class addEspnMemberInfo1587353403828 implements MigrationInterface {
    name = 'addEspnMemberInfo1587353403828'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."user" ADD COLUMN "espnMember" jsonb`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."user" DROP COLUMN "espnMember"`, undefined);
    }
}
