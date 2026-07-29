-- Safely add STARTED to InvoiceStatus enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STARTED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'InvoiceStatus')) THEN
    ALTER TYPE "InvoiceStatus" ADD VALUE 'STARTED';
  END IF;
END $$;

-- Safely add startedAt column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Invoice' AND column_name = 'startedAt') THEN
    ALTER TABLE "Invoice" ADD COLUMN "startedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Safely add completedAt column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Invoice' AND column_name = 'completedAt') THEN
    ALTER TABLE "Invoice" ADD COLUMN "completedAt" TIMESTAMP(3);
  END IF;
END $$;
