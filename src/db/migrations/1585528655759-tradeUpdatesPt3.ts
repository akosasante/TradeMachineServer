import {MigrationInterface, QueryRunner} from "typeorm";

export class tradeUpdatesPt31585528655759 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`-- noinspection SqlResolve

ALTER TABLE "dev"."trade_participant" RENAME COLUMN "tradeParticipantId" TO "id"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "id" SET DATA TYPE uuid USING (uuid_generate_v4())`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`);

    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" RENAME COLUMN "id" TO "tradeParticipantId"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "id" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "id" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "id" SET DEFAULT nextval('"trade_participant_tradeParticipantId_seq"'::regclass) ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 )`);
    }

}
