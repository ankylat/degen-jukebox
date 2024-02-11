/*
  Warnings:

  - You are about to drop the column `playsCount` on the `Recommendation` table. All the data in the column will be lost.
  - You are about to drop the `QueueItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "QueueItem" DROP CONSTRAINT "QueueItem_recommendationId_fkey";

-- AlterTable
ALTER TABLE "Recommendation" DROP COLUMN "playsCount",
ADD COLUMN     "castHash" TEXT;

-- DropTable
DROP TABLE "QueueItem";

-- CreateTable
CREATE TABLE "Cycle" (
    "id" SERIAL NOT NULL,
    "cycleIndex" INTEGER NOT NULL,
    "startingTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cycleDuration" INTEGER,
    "numberOfRecommendations" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);
