-- Add snapshot fields to Appointment table
ALTER TABLE "Appointment" ADD COLUMN "serviceName" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "serviceDuration" INTEGER;
ALTER TABLE "Appointment" ADD COLUMN "servicePrice" DECIMAL(10,2);

-- Add index for serviceId (if not exists)
CREATE INDEX IF NOT EXISTS "Appointment_serviceId_idx" ON "Appointment"("serviceId");

-- Add appointmentId to Photo table
ALTER TABLE "Photo" ADD COLUMN "appointmentId" TEXT;

-- Create index for appointmentId
CREATE INDEX IF NOT EXISTS "Photo_appointmentId_idx" ON "Photo"("appointmentId");

-- Drop existing foreign key constraints that use CASCADE
-- Note: PostgreSQL doesn't support ALTER CONSTRAINT, so we need to drop and recreate
-- Prisma uses specific naming: {Table}_{column}_fkey

-- Drop Appointment -> Client foreign key (CASCADE -> RESTRICT)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Appointment_clientId_fkey'
  ) THEN
    ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_clientId_fkey";
  END IF;
END $$;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" 
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop Appointment -> Service foreign key (CASCADE -> RESTRICT)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Appointment_serviceId_fkey'
  ) THEN
    ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_serviceId_fkey";
  END IF;
END $$;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" 
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop Photo -> Client foreign key (CASCADE -> RESTRICT)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'Photo_clientId_fkey'
  ) THEN
    ALTER TABLE "Photo" DROP CONSTRAINT "Photo_clientId_fkey";
  END IF;
END $$;

ALTER TABLE "Photo" ADD CONSTRAINT "Photo_clientId_fkey" 
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add Photo -> Appointment foreign key (SetNull)
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_appointmentId_fkey" 
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

