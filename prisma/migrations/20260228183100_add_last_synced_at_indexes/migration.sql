-- CreateIndex
CREATE INDEX "draft_pick_lastSyncedAt_idx" ON "draft_pick"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "player_lastSyncedAt_idx" ON "player"("lastSyncedAt");

-- CreateIndex
CREATE INDEX "team_lastSyncedAt_idx" ON "team"("lastSyncedAt");
