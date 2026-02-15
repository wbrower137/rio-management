/*
  Warnings:

  - The `status` column on the `Opportunity` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('pursue_now', 'defer', 'reevaluate', 'reject');

-- AlterTable
ALTER TABLE "Opportunity" DROP COLUMN "status",
ADD COLUMN     "status" "OpportunityStatus" NOT NULL DEFAULT 'pursue_now';
