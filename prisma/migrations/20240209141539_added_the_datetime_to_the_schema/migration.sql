/*
  Warnings:

  - The `endingRecommendationTimestamp` column on the `Recommendation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `startingRecommendationTimestamp` column on the `Recommendation` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Recommendation" DROP COLUMN "endingRecommendationTimestamp",
ADD COLUMN     "endingRecommendationTimestamp" TIMESTAMP(3),
DROP COLUMN "startingRecommendationTimestamp",
ADD COLUMN     "startingRecommendationTimestamp" TIMESTAMP(3);
