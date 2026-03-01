-- CreateIndex
CREATE INDEX "draft_pick_type_lastSyncedAt_idx" ON "draft_pick"("type", "lastSyncedAt");

-- CreateIndex
CREATE INDEX "player_league_lastSyncedAt_idx" ON "player"("league", "lastSyncedAt");
