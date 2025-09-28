-- CreateTable
CREATE TABLE "oban_jobs" (
    "id" BIGSERIAL NOT NULL,
    "queue" TEXT NOT NULL DEFAULT 'default',
    "worker" TEXT NOT NULL,
    "args" JSONB NOT NULL DEFAULT '{}',
    "errors" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 20,
    "inserted_at" TIMESTAMP(6) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "scheduled_at" TIMESTAMP(6) NOT NULL DEFAULT timezone('UTC'::text, now()),
    "attempted_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "attempted_by" TEXT[],
    "discarded_at" TIMESTAMP(6),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meta" JSONB DEFAULT '{}',
    "cancelled_at" TIMESTAMP(6),
    "state" "oban_job_state" NOT NULL DEFAULT 'available',

    CONSTRAINT "oban_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oban_peers" (
    "name" TEXT NOT NULL,
    "node" TEXT NOT NULL,
    "started_at" TIMESTAMP(6) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "oban_peers_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "oban_jobs_args_index" ON "oban_jobs" USING GIN ("args");

-- CreateIndex
CREATE INDEX "oban_jobs_meta_index" ON "oban_jobs" USING GIN ("meta");

-- CreateIndex
CREATE INDEX "oban_jobs_state_queue_priority_scheduled_at_id_index" ON "oban_jobs"("state", "queue", "priority", "scheduled_at", "id");
