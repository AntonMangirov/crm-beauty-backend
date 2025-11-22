-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('MASTER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "public"."AppointmentSource" AS ENUM ('WEB', 'TELEGRAM', 'VK', 'WHATSAPP', 'MANUAL', 'PHONE');

-- CreateEnum
CREATE TYPE "public"."IntegrationType" AS ENUM ('TELEGRAM', 'VK', 'WHATSAPP', 'GOOGLE_CALENDAR');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" "public"."UserRole" NOT NULL DEFAULT 'MASTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Service" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "allergies" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Appointment" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "source" "public"."AppointmentSource" NOT NULL DEFAULT 'WEB',
    "notes" TEXT,
    "price" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Photo" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Integration" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "type" "public"."IntegrationType" NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "public"."User"("slug");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_slug_idx" ON "public"."User"("slug");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "public"."User"("isActive");

-- CreateIndex
CREATE INDEX "Service_masterId_idx" ON "public"."Service"("masterId");

-- CreateIndex
CREATE INDEX "Service_isActive_idx" ON "public"."Service"("isActive");

-- CreateIndex
CREATE INDEX "Client_masterId_idx" ON "public"."Client"("masterId");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "public"."Client"("phone");

-- CreateIndex
CREATE INDEX "Client_email_idx" ON "public"."Client"("email");

-- CreateIndex
CREATE INDEX "Client_isActive_idx" ON "public"."Client"("isActive");

-- CreateIndex
CREATE INDEX "Appointment_masterId_idx" ON "public"."Appointment"("masterId");

-- CreateIndex
CREATE INDEX "Appointment_clientId_idx" ON "public"."Appointment"("clientId");

-- CreateIndex
CREATE INDEX "Appointment_startAt_idx" ON "public"."Appointment"("startAt");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "public"."Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_createdAt_idx" ON "public"."Appointment"("createdAt");

-- CreateIndex
CREATE INDEX "Photo_clientId_idx" ON "public"."Photo"("clientId");

-- CreateIndex
CREATE INDEX "Photo_createdAt_idx" ON "public"."Photo"("createdAt");

-- CreateIndex
CREATE INDEX "Integration_masterId_idx" ON "public"."Integration"("masterId");

-- CreateIndex
CREATE INDEX "Integration_type_idx" ON "public"."Integration"("type");

-- CreateIndex
CREATE INDEX "Integration_isActive_idx" ON "public"."Integration"("isActive");

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Photo" ADD CONSTRAINT "Photo_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Integration" ADD CONSTRAINT "Integration_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
