-- AlterTable
ALTER TABLE "Client" ADD COLUMN "telegramUsername" TEXT;

-- CreateIndex
CREATE INDEX "Client_telegramUsername_idx" ON "Client"("telegramUsername");




