import {MigrationInterface, QueryRunner} from "typeorm";

export class updateTradeParticipantEnums1593402142226 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."trade_participant_participanttype_enum" RENAME TO "trade_participant_participanttype_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."trade_participant_participanttype_enum" AS ENUM('1', '2')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "participantType" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "participantType" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."trade_participant" SET "participantType" = '2' WHERE "participantType" = '1'`)
        await queryRunner.query(`UPDATE "dev"."trade_participant" SET "participantType" = '1' WHERE "participantType" = '0'`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "participantType" TYPE "trade_participant_participanttype_enum" USING "participantType"::text::trade_participant_participanttype_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "participantType" SET DEFAULT '1'`)
        await queryRunner.query(`DROP TYPE "dev"."trade_participant_participanttype_enum_old"`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TYPE "dev"."trade_participant_participanttype_enum" RENAME TO "trade_participant_participanttype_enum_old"`)
        await queryRunner.query(`CREATE TYPE "dev"."trade_participant_participanttype_enum" AS ENUM('Player', 'Pick')`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "participantType" DROP DEFAULT`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "participantType" TYPE CHARACTER VARYING`)
        await queryRunner.query(`UPDATE "dev"."trade_participant" SET "participantType" = '1' WHERE "participantType" = '0'`)
        await queryRunner.query(`UPDATE "dev"."trade_participant" SET "participantType" = '2' WHERE "participantType" = '1'`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "participantType" TYPE "trade_participant_participanttype_enum" USING  "participantType"::text::trade_participant_participanttype_enum`)
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ALTER COLUMN "participantType" SET DEFAULT 'Player'`)
        await queryRunner.query(`DROP TYPE "dev"."trade_participant_participanttype_enum_old"`, undefined);
    }

}
