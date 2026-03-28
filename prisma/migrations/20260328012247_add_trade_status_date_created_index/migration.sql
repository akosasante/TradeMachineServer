-- CreateIndex
CREATE INDEX "trade_status_dateCreated_idx" ON "trade"("status", "dateCreated" DESC);
