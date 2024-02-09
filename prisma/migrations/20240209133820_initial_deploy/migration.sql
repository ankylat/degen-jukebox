-- CreateTable
CREATE TABLE "User" (
    "fid" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "activeToken" TEXT,
    "activeExpires" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("fid")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recommendationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "youtubeID" TEXT,
    "status" TEXT,
    "duration" INTEGER NOT NULL,
    "playsCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueItem" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "bidAmount" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'queued',

    CONSTRAINT "QueueItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("fid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
