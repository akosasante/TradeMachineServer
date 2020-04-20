import {MigrationInterface, QueryRunner} from "typeorm";

export class newInit1583688409179 implements MigrationInterface {
    name = 'newInit1583688409179'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "dev"."trade_participant_participanttype_enum" AS ENUM('0', '1')`, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."trade_participant" ("tradeParticipantId" SERIAL NOT NULL, "participantType" "dev"."trade_participant_participanttype_enum" NOT NULL DEFAULT '1', "tradeId" uuid, "teamId" uuid, CONSTRAINT "PK_60f29eec159bc8b923a8ebda680" PRIMARY KEY ("tradeParticipantId"))`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_6cefad40c0c9cbb34500c9f2b5" ON "dev"."trade_participant" ("tradeId", "teamId") `, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."trade" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8a1cea805d050478a2482f0960e" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TYPE "dev"."trade_item_tradeitemtype_enum" AS ENUM('Player', 'Pick')`, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."trade_item" ("tradeItemId" SERIAL NOT NULL, "tradeItemType" "dev"."trade_item_tradeitemtype_enum" NOT NULL DEFAULT 'Player', "tradeId" uuid, "playerId" uuid, "pickId" uuid, "senderId" uuid, "recipientId" uuid, CONSTRAINT "PK_1d90e81ec4d3fc587b884b55f15" PRIMARY KEY ("tradeItemId"))`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cbff369d9b0f3e749d8895fbbb" ON "dev"."trade_item" ("tradeId", "senderId", "recipientId", "playerId", "pickId") `, undefined);
        await queryRunner.query(`CREATE TYPE "dev"."team_status_enum" AS ENUM('active', 'inactive')`, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."team" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "espnId" integer, "name" character varying NOT NULL, "status" "dev"."team_status_enum" NOT NULL DEFAULT 'inactive', CONSTRAINT "PK_d4c9ceb4d198d0214d982242c10" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TYPE "dev"."player_league_enum" AS ENUM('Majors', 'High Minors', 'Low Minors')`, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."player" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "league" "dev"."player_league_enum", "mlbTeam" character varying, "meta" json, "leagueTeamId" uuid, CONSTRAINT "PK_9fd0dba262c28fb584448f6ec12" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_40e3ad1d41d05dda60e9ba76cc" ON "dev"."player" ("name") `, undefined);
        await queryRunner.query(`CREATE TYPE "dev"."draft_pick_type_enum" AS ENUM('Majors', 'High Minors', 'Low Minors')`, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."draft_pick" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "round" integer NOT NULL, "pickNumber" integer, "season" integer, "type" "dev"."draft_pick_type_enum" NOT NULL, "currentOwnerId" uuid, "originalOwnerId" uuid, CONSTRAINT "PK_173c858141c28aba85f3f2b66bb" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_71715a4e4ab6bea1e8167d85c3" ON "dev"."draft_pick" ("season", "round", "pickNumber") `, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."general_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "deadline" jsonb NOT NULL, CONSTRAINT "PK_0bb00a97d86bc347069edddc494" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."scheduled_downtime" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP NOT NULL, "cancelledDate" TIMESTAMP, "reason" character varying, CONSTRAINT "PK_90d86d54ed0fb02944c81f17dbc" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TYPE "dev"."user_role_enum" AS ENUM('admin', 'owner')`, undefined);
        await queryRunner.query(`CREATE TYPE "dev"."user_status_enum" AS ENUM('active', 'inactive')`, undefined);
        await queryRunner.query(`CREATE TABLE "dev"."user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), "email" character varying NOT NULL, "password" character varying, "displayName" character varying, "slackUsername" character varying, "role" "dev"."user_role_enum" NOT NULL DEFAULT 'owner', "lastLoggedIn" TIMESTAMP, "passwordResetExpiresOn" TIMESTAMP, "passwordResetToken" character varying, "status" "dev"."user_status_enum" NOT NULL DEFAULT 'active', CONSTRAINT "UQ_37a55ad1dbb070054bece40642f" UNIQUE ("email"), CONSTRAINT "PK_46a8d3f2767f238737f7bbde32a" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ADD CONSTRAINT "FK_55814676906f1f2c458fa255042" FOREIGN KEY ("tradeId") REFERENCES "dev"."trade"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" ADD CONSTRAINT "FK_6f42978de8c286663f97f12c9dc" FOREIGN KEY ("teamId") REFERENCES "dev"."team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD CONSTRAINT "FK_b0526160a5fca917459d481e202" FOREIGN KEY ("tradeId") REFERENCES "dev"."trade"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD CONSTRAINT "FK_ef0ef7a58e2c64ceac8ea314d74" FOREIGN KEY ("playerId") REFERENCES "dev"."player"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD CONSTRAINT "FK_502401fd6c09572aee8fb1d5ac7" FOREIGN KEY ("pickId") REFERENCES "dev"."draft_pick"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD CONSTRAINT "FK_93c36c896adc55ffa2fde088079" FOREIGN KEY ("senderId") REFERENCES "dev"."team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" ADD CONSTRAINT "FK_1abdf634a91dc15221fecbd2535" FOREIGN KEY ("recipientId") REFERENCES "dev"."team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."player" ADD CONSTRAINT "FK_1aad05b09bda2079429cd8ba9d8" FOREIGN KEY ("leagueTeamId") REFERENCES "dev"."team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ADD CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6bd" FOREIGN KEY ("currentOwnerId") REFERENCES "dev"."team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" ADD CONSTRAINT "FK_5e448065a1f32514925e8045b61" FOREIGN KEY ("originalOwnerId") REFERENCES "dev"."team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" DROP CONSTRAINT "FK_5e448065a1f32514925e8045b61"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."draft_pick" DROP CONSTRAINT "FK_edbfdecf43bec56ee160c9ba6bd"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."player" DROP CONSTRAINT "FK_1aad05b09bda2079429cd8ba9d8"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP CONSTRAINT "FK_1abdf634a91dc15221fecbd2535"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP CONSTRAINT "FK_93c36c896adc55ffa2fde088079"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP CONSTRAINT "FK_502401fd6c09572aee8fb1d5ac7"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP CONSTRAINT "FK_ef0ef7a58e2c64ceac8ea314d74"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_item" DROP CONSTRAINT "FK_b0526160a5fca917459d481e202"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" DROP CONSTRAINT "FK_6f42978de8c286663f97f12c9dc"`, undefined);
        await queryRunner.query(`ALTER TABLE "dev"."trade_participant" DROP CONSTRAINT "FK_55814676906f1f2c458fa255042"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."user"`, undefined);
        await queryRunner.query(`DROP TYPE "dev"."user_status_enum"`, undefined);
        await queryRunner.query(`DROP TYPE "dev"."user_role_enum"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."scheduled_downtime"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."general_settings"`, undefined);
        await queryRunner.query(`DROP INDEX "dev"."IDX_71715a4e4ab6bea1e8167d85c3"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."draft_pick"`, undefined);
        await queryRunner.query(`DROP TYPE "dev"."draft_pick_type_enum"`, undefined);
        await queryRunner.query(`DROP INDEX "dev"."IDX_40e3ad1d41d05dda60e9ba76cc"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."player"`, undefined);
        await queryRunner.query(`DROP TYPE "dev"."player_league_enum"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."team"`, undefined);
        await queryRunner.query(`DROP TYPE "dev"."team_status_enum"`, undefined);
        await queryRunner.query(`DROP INDEX "dev"."IDX_cbff369d9b0f3e749d8895fbbb"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."trade_item"`, undefined);
        await queryRunner.query(`DROP TYPE "dev"."trade_item_tradeitemtype_enum"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."trade"`, undefined);
        await queryRunner.query(`DROP INDEX "dev"."IDX_6cefad40c0c9cbb34500c9f2b5"`, undefined);
        await queryRunner.query(`DROP TABLE "dev"."trade_participant"`, undefined);
        await queryRunner.query(`DROP TYPE "dev"."trade_participant_participanttype_enum"`, undefined);
    }

}
