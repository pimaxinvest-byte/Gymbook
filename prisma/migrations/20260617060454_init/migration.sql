-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'CLIENT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'CANCELLED', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('INDIVIDUAL', 'SGT');

-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('INDIVIDUAL', 'SGT');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('ASSIGNED', 'DEDUCTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'UNPAID', 'PARTIAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'BIZUM', 'OTHER');

-- CreateEnum
CREATE TYPE "CreditLogAction" AS ENUM ('CREATED', 'MARKED_PAID', 'MARKED_UNPAID', 'PARTIALLY_PAID', 'CREDIT_USED', 'CREDIT_RESTORED', 'ADJUSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "telegramChatId" TEXT,
    "telegramUsername" TEXT,
    "telegramPhone" TEXT,
    "telegramConnected" BOOLEAN NOT NULL DEFAULT false,
    "telegramToken" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f97316',
    "bio" TEXT,
    "specialties" TEXT[],
    "paymentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherActivity" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ClientStatus" NOT NULL DEFAULT 'PENDING',
    "lastName" TEXT,
    "phone" TEXT,
    "goals" TEXT,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT false,
    "preferredActivityId" TEXT,
    "preferredTeacherId" TEXT,
    "notes" TEXT,
    "rejectedReason" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientTeacher" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultDuration" INTEGER NOT NULL DEFAULT 60,
    "maxCapacity" INTEGER NOT NULL DEFAULT 1,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "clientId" TEXT,
    "spaceId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "startDatetime" TIMESTAMP(3) NOT NULL,
    "endDatetime" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "sessionType" "SessionType" NOT NULL DEFAULT 'INDIVIDUAL',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "color" TEXT,
    "notes" TEXT,
    "recurrenceRuleId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingParticipant" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRecurrenceRule" (
    "id" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 60,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "spaceId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "sessionType" "SessionType" NOT NULL DEFAULT 'INDIVIDUAL',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingRecurrenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "startDatetime" TIMESTAMP(3) NOT NULL,
    "endDatetime" TIMESTAMP(3) NOT NULL,
    "maxCapacity" INTEGER NOT NULL DEFAULT 1,
    "minDuration" INTEGER NOT NULL DEFAULT 30,
    "maxDuration" INTEGER NOT NULL DEFAULT 120,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "daysOfWeek" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCredits" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "creditType" "CreditType" NOT NULL DEFAULT 'INDIVIDUAL',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalAssigned" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "amountPaid" DOUBLE PRECISION,
    "paymentMethod" "PaymentMethod",
    "paymentDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCredits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "clientCreditsId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "bookingId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLog" (
    "id" TEXT NOT NULL,
    "clientCreditsId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "actionType" "CreditLogAction" NOT NULL,
    "previousValueJson" JSONB,
    "newValueJson" JSONB,
    "amount" INTEGER,
    "performedById" TEXT NOT NULL,
    "notes" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "gymName" TEXT NOT NULL DEFAULT 'Mi Gimnasio',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#f97316',
    "secondaryColor" TEXT NOT NULL DEFAULT '#ea580c',
    "accentColor" TEXT NOT NULL DEFAULT '#fb923c',
    "defaultSessionDuration" INTEGER NOT NULL DEFAULT 60,
    "openingTime" TEXT NOT NULL DEFAULT '06:00',
    "closingTime" TEXT NOT NULL DEFAULT '22:00',
    "bookingConfirmationText" TEXT NOT NULL DEFAULT '¡Tu reserva ha sido confirmada!',
    "cancellationHoursLimit" INTEGER NOT NULL DEFAULT 24,
    "cancellationRefundCredits" BOOLEAN NOT NULL DEFAULT true,
    "creditExpiryMonths" INTEGER NOT NULL DEFAULT 6,
    "sgtMaxClients" INTEGER NOT NULL DEFAULT 5,
    "requireAdminApproval" BOOLEAN NOT NULL DEFAULT true,
    "telegramBotName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramSettings" (
    "id" TEXT NOT NULL,
    "botToken" TEXT,
    "botName" TEXT,
    "adminChatId" TEXT,
    "notifyAdmin" BOOLEAN NOT NULL DEFAULT true,
    "notifyTeacher" BOOLEAN NOT NULL DEFAULT true,
    "notifyClient" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherHarbizConnection" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "harbizProfId" TEXT,
    "harbizEmail" TEXT,
    "harbizPasswordEncrypted" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherHarbizConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdMapping" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "gymBookId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'HARBIZ',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalIdMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSyncLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL DEFAULT 'FULL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "clientsFound" INTEGER NOT NULL DEFAULT 0,
    "clientsCreated" INTEGER NOT NULL DEFAULT 0,
    "clientsUpdated" INTEGER NOT NULL DEFAULT 0,
    "sessionsFound" INTEGER NOT NULL DEFAULT 0,
    "sessionsCreated" INTEGER NOT NULL DEFAULT 0,
    "packsFound" INTEGER NOT NULL DEFAULT 0,
    "packsCreated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "diffJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditPackagePreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "creditType" "CreditType" NOT NULL DEFAULT 'INDIVIDUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditPackagePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherBillingSettings" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "businessName" TEXT,
    "nif" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "issueDocuments" BOOLEAN NOT NULL DEFAULT false,
    "documentType" TEXT NOT NULL DEFAULT 'TICKET',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'FAC',
    "ticketPrefix" TEXT NOT NULL DEFAULT 'TIC',
    "lastInvoiceNum" INTEGER NOT NULL DEFAULT 0,
    "lastTicketNum" INTEGER NOT NULL DEFAULT 0,
    "footerNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherBillingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalImportPermission" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedByIp" TEXT,
    "userAgent" TEXT,
    "revokedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ExternalImportPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "billingSettingsId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "teacherNif" TEXT,
    "teacherAddress" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientNif" TEXT,
    "items" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "creditPackageId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_userId_key" ON "Teacher"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherActivity_teacherId_activityId_key" ON "TeacherActivity"("teacherId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientTeacher_clientId_teacherId_key" ON "ClientTeacher"("clientId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "Space_name_key" ON "Space"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_name_key" ON "Activity"("name");

-- CreateIndex
CREATE INDEX "Booking_startDatetime_idx" ON "Booking"("startDatetime");

-- CreateIndex
CREATE INDEX "Booking_teacherId_idx" ON "Booking"("teacherId");

-- CreateIndex
CREATE INDEX "Booking_activityId_idx" ON "Booking"("activityId");

-- CreateIndex
CREATE INDEX "Booking_spaceId_idx" ON "Booking"("spaceId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_clientId_idx" ON "Booking"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingParticipant_bookingId_clientId_key" ON "BookingParticipant"("bookingId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_bookingId_clientId_key" ON "WaitlistEntry"("bookingId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCredits_clientId_teacherId_creditType_key" ON "ClientCredits"("clientId", "teacherId", "creditType");

-- CreateIndex
CREATE INDEX "CreditLog_clientId_idx" ON "CreditLog"("clientId");

-- CreateIndex
CREATE INDEX "CreditLog_clientCreditsId_idx" ON "CreditLog"("clientCreditsId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherHarbizConnection_teacherId_key" ON "TeacherHarbizConnection"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherHarbizConnection_teacherId_idx" ON "TeacherHarbizConnection"("teacherId");

-- CreateIndex
CREATE INDEX "ExternalIdMapping_entityType_gymBookId_idx" ON "ExternalIdMapping"("entityType", "gymBookId");

-- CreateIndex
CREATE INDEX "ExternalIdMapping_entityType_externalId_idx" ON "ExternalIdMapping"("entityType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdMapping_entityType_externalId_source_key" ON "ExternalIdMapping"("entityType", "externalId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdMapping_entityType_gymBookId_source_key" ON "ExternalIdMapping"("entityType", "gymBookId", "source");

-- CreateIndex
CREATE INDEX "ExternalSyncLog_connectionId_idx" ON "ExternalSyncLog"("connectionId");

-- CreateIndex
CREATE INDEX "ExternalSyncLog_startedAt_idx" ON "ExternalSyncLog"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherBillingSettings_teacherId_key" ON "TeacherBillingSettings"("teacherId");

-- CreateIndex
CREATE INDEX "TeacherBillingSettings_teacherId_idx" ON "TeacherBillingSettings"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalImportPermission_teacherId_key" ON "ExternalImportPermission"("teacherId");

-- CreateIndex
CREATE INDEX "ExternalImportPermission_teacherId_idx" ON "ExternalImportPermission"("teacherId");

-- CreateIndex
CREATE INDEX "Invoice_billingSettingsId_idx" ON "Invoice"("billingSettingsId");

-- CreateIndex
CREATE INDEX "Invoice_date_idx" ON "Invoice"("date");

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherActivity" ADD CONSTRAINT "TeacherActivity_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherActivity" ADD CONSTRAINT "TeacherActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_preferredActivityId_fkey" FOREIGN KEY ("preferredActivityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_preferredTeacherId_fkey" FOREIGN KEY ("preferredTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTeacher" ADD CONSTRAINT "ClientTeacher_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTeacher" ADD CONSTRAINT "ClientTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "BookingRecurrenceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingParticipant" ADD CONSTRAINT "BookingParticipant_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingParticipant" ADD CONSTRAINT "BookingParticipant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCredits" ADD CONSTRAINT "ClientCredits_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCredits" ADD CONSTRAINT "ClientCredits_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCredits" ADD CONSTRAINT "ClientCredits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_clientCreditsId_fkey" FOREIGN KEY ("clientCreditsId") REFERENCES "ClientCredits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLog" ADD CONSTRAINT "CreditLog_clientCreditsId_fkey" FOREIGN KEY ("clientCreditsId") REFERENCES "ClientCredits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLog" ADD CONSTRAINT "CreditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLog" ADD CONSTRAINT "CreditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLog" ADD CONSTRAINT "CreditLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHarbizConnection" ADD CONSTRAINT "TeacherHarbizConnection_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSyncLog" ADD CONSTRAINT "ExternalSyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "TeacherHarbizConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherBillingSettings" ADD CONSTRAINT "TeacherBillingSettings_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalImportPermission" ADD CONSTRAINT "ExternalImportPermission_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingSettingsId_fkey" FOREIGN KEY ("billingSettingsId") REFERENCES "TeacherBillingSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
