-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'STARTED';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "completedAt" TIMESTAMP(3);
