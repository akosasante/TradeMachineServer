-- AlterTable
ALTER TABLE "trade" ADD COLUMN     "acceptedByDetails" JSONB,
ADD COLUMN     "submittedAt" TIMESTAMP(6),
ADD COLUMN     "submittedById" UUID;
