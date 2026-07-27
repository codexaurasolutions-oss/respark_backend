-- AlterTable
ALTER TABLE "Product" ADD COLUMN "favourite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "unitConversion" DECIMAL(10, 4);
