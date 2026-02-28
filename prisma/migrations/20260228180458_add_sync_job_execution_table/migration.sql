-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('espn_team_sync', 'minors_sync', 'mlb_players_sync', 'draft_picks_sync');

-- CreateEnum
CREATE TYPE "SyncDatabaseScope" AS ENUM ('production', 'staging', 'both');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('started', 'completed', 'failed');

-- CreateTable
CREATE TABLE "sync_job_execution" (
    "id" UUID NOT NULL,
    "dateCreated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobType" "SyncJobType" NOT NULL,
    "databaseScope" "SyncDatabaseScope" NOT NULL,
    "status" "SyncJobStatus" NOT NULL,
    "startedAt" TIMESTAMP(6) NOT NULL,
    "completedAt" TIMESTAMP(6),
    "durationMs" INTEGER,
    "recordsProcessed" INTEGER,
    "recordsUpdated" INTEGER,
    "recordsSkipped" INTEGER,
    "errorMessage" TEXT,
    "obanJobId" BIGINT,
    "traceId" VARCHAR,
    "metadata" JSONB,

    CONSTRAINT "sync_job_execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_job_execution_jobType_startedAt_idx" ON "sync_job_execution"("jobType", "startedAt");

-- CreateIndex
CREATE INDEX "sync_job_execution_status_jobType_idx" ON "sync_job_execution"("status", "jobType");

-- CreateIndex
CREATE INDEX "sync_job_execution_databaseScope_jobType_idx" ON "sync_job_execution"("databaseScope", "jobType");
