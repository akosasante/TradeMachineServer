import {MigrationInterface, QueryRunner} from "typeorm";

export class addEmailTable1586580371249 implements MigrationInterface {
    name = 'addEmailTable1586580371249'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dev"."email" ("messageId" character varying NOT NULL, "status" character varying, "dateCreated" TIMESTAMP NOT NULL DEFAULT now(), "dateModified" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b77796b667171ffa41401cfa393be9a3" PRIMARY KEY ("messageId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_945a167cdde65d4fb6bf5508d9f75584" ON "dev"."email" ("status")`, undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "dev"."email"`, undefined);
        await queryRunner.query(`DROP INDEX "dev"."IDX_945a167cdde65d4fb6bf5508d9f75584"`, undefined);
    }
}
