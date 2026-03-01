-- AlterTable
ALTER TABLE "draft_pick" ADD COLUMN     "lastSyncedAt" TIMESTAMP(6);

-- AlterTable
ALTER TABLE "player" ADD COLUMN     "lastSyncedAt" TIMESTAMP(6);

-- AlterTable
ALTER TABLE "team" ADD COLUMN     "lastSyncedAt" TIMESTAMP(6);
