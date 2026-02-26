-- AlterTable
ALTER TABLE "Agent" ADD COLUMN "openclawConfig" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Agent" ADD COLUMN "agentTokenHash" TEXT;
ALTER TABLE "Agent" ADD COLUMN "agentTokenPreview" TEXT;

-- CreateTable
CREATE TABLE "AgentMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "claimedAt" DATETIME,
    "leaseExpiresAt" DATETIME,
    "completedAt" DATETIME,
    "failureReason" TEXT,
    "responseMessageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentMention_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentMention_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentMention_agentId_sourceMessageId_key" ON "AgentMention"("agentId", "sourceMessageId");

-- CreateIndex
CREATE INDEX "AgentMention_agentId_status_createdAt_idx" ON "AgentMention"("agentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMention_agentId_leaseExpiresAt_idx" ON "AgentMention"("agentId", "leaseExpiresAt");
