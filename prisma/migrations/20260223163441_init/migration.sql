-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('ORG_ADMIN', 'REGION_ADMIN', 'SUBREGION_ADMIN', 'ZONE_ADMIN', 'CAMPUS_ADMIN', 'TEACHER', 'ACCOUNTANT', 'PARENT', 'STAFF');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrganizationCategory" AS ENUM ('SCHOOL', 'COLLEGE', 'ACADEMY', 'INSTITUTE', 'UNIVERSITY', 'OTHERS');

-- CreateEnum
CREATE TYPE "OrganizationStructure" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('ORG_IDENTITY', 'LEGAL', 'CONTACT_ADDRESS', 'BRANDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('HEAD_OFFICE', 'BILLING', 'CAMPUS', 'OTHER');

-- CreateEnum
CREATE TYPE "UnitScopeType" AS ENUM ('REGION', 'SUBREGION', 'CITY', 'ZONE', 'CAMPUS');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('LOGO', 'FAVICON', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaVariant" AS ENUM ('ORIGINAL', 'SM', 'MD', 'LG', 'DARK', 'PRINT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('MEMBERSHIP_INVITED', 'MEMBERSHIP_ROLE_CHANGED', 'MEMBERSHIP_SCOPE_CHANGED', 'MEMBERSHIP_REVOKED', 'MEMBERSHIP_REACTIVATED', 'PAYMENT_RECONCILED', 'PAYMENT_REVERSED', 'PAYMENT_FAILED', 'FEE_POSTING_STARTED', 'FEE_POSTING_COMPLETED', 'FEE_POSTING_FAILED', 'STUDENT_ENROLLED', 'STUDENT_PROMOTED', 'STUDENT_TRANSFERRED', 'STUDENT_WITHDRAWN', 'STUDENT_RETAINED', 'STUDENT_GRADUATED', 'ACADEMIC_YEAR_CLOSED', 'ACADEMIC_YEAR_ACTIVATED', 'PROMOTION_RUN_COMPLETED', 'PROMOTION_RUN_FAILED');

-- CreateEnum
CREATE TYPE "FinanceRoutingMode" AS ENUM ('CAMPUS_PRIMARY', 'NEAREST_PARENT_PRIMARY');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('OTC', 'BANK_TRANSFER', 'ONLINE_GATEWAY', 'MOBILE_WALLET', 'ONEBILL', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'RECONCILED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('EASYPAISA', 'JAZZCASH', 'ONEBILL', 'KUICKPAY', 'STRIPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "ChallanStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('CHALLAN_CREATED', 'PAYMENT_RECEIVED', 'ADJUSTMENT', 'REFUND', 'WAIVER');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('MONTHLY', 'TERM', 'ANNUAL');

-- CreateEnum
CREATE TYPE "PostingRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SENT', 'FAILED', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "ReminderTriggerType" AS ENUM ('BEFORE_DUE', 'AFTER_DUE', 'PARTIAL_PAYMENT', 'FINAL_NOTICE', 'RECEIPT');

-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PROMOTED', 'RETAINED', 'TRANSFERRED', 'WITHDRAWN', 'GRADUATED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HALF_DAY');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('UNIT_TEST', 'MID_TERM', 'FINAL', 'TERM', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'ACTIVE', 'LOCKED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PromotionRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "QrTokenType" AS ENUM ('FEE_PAYMENT', 'PARENT_ACCESS', 'ADMISSION', 'ATTENDANCE', 'LOGIN');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ControlMode" AS ENUM ('CENTRALIZED', 'CAMPUS_AUTONOMOUS');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "emailVerifyToken" TEXT,
    "emailVerifyExpires" TIMESTAMP(3),
    "platformRole" "PlatformRole",
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpSession" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrToken" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "type" "QrTokenType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "label" TEXT,
    "oneTimeUse" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "organizationId" VARCHAR(11) NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "stepsCompleted" JSONB NOT NULL DEFAULT '[]',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "DashboardAction" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11),
    "role" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'primary',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationPlan" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "planType" "PlanType" NOT NULL DEFAULT 'FREE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxStudents" INTEGER,
    "maxCampuses" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanFeature" (
    "id" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationControlPolicy" (
    "organizationId" VARCHAR(11) NOT NULL,
    "feeControlMode" "ControlMode" NOT NULL DEFAULT 'CAMPUS_AUTONOMOUS',
    "academicControlMode" "ControlMode" NOT NULL DEFAULT 'CAMPUS_AUTONOMOUS',
    "messagingControlMode" "ControlMode" NOT NULL DEFAULT 'CAMPUS_AUTONOMOUS',
    "postingControlMode" "ControlMode" NOT NULL DEFAULT 'CAMPUS_AUTONOMOUS',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationControlPolicy_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "FeeTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" "FeeFrequency" NOT NULL DEFAULT 'MONTHLY',
    "applicableGrade" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampusHealthScore" (
    "organizationId" VARCHAR(11) NOT NULL,
    "campusId" INTEGER NOT NULL,
    "collectionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "attendanceRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "academicScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "enrollmentGrowth" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "compositeScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "CampusOperationalStatus" (
    "campusId" INTEGER NOT NULL,
    "isFinancialLocked" BOOLEAN NOT NULL DEFAULT false,
    "isAcademicLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockReason" TEXT,
    "lockedByUserId" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampusOperationalStatus_pkey" PRIMARY KEY ("campusId")
);

-- CreateTable
CREATE TABLE "OrganizationSequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrganizationSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" VARCHAR(11) NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "onboardingStep" "OnboardingStep" NOT NULL DEFAULT 'ORG_IDENTITY',
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "organizationCategory" "OrganizationCategory" NOT NULL,
    "organizationStructure" "OrganizationStructure" NOT NULL,
    "registrationNumber" TEXT,
    "taxNumber" TEXT,
    "establishedDate" DATE,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "country" TEXT,
    "provinceState" TEXT,
    "district" TEXT,
    "tehsil" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "organizationEmail" TEXT,
    "organizationPhone" TEXT,
    "organizationMobile" TEXT,
    "organizationWhatsApp" TEXT,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "logoKey" TEXT,
    "logoUpdatedAt" TIMESTAMP(3),
    "logoLightUrl" TEXT,
    "logoDarkUrl" TEXT,
    "logoPrintUrl" TEXT,
    "financeRoutingMode" "FinanceRoutingMode" NOT NULL DEFAULT 'CAMPUS_PRIMARY',

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationContact" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAddress" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "AddressType" NOT NULL,
    "country" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "postalCode" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationBank" (
    "id" SERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountTitle" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT,
    "accountNumber" TEXT NOT NULL,
    "iban" TEXT,
    "swiftCode" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrganizationBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitCodeSequence" (
    "id" TEXT NOT NULL,
    "scopeType" "UnitScopeType" NOT NULL,
    "scopeId" TEXT,
    "organizationId" VARCHAR(11) NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UnitCodeSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitCode" VARCHAR(5) NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubRegion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitCode" VARCHAR(5) NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "regionId" TEXT,

    CONSTRAINT "SubRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitCode" VARCHAR(5) NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "regionId" TEXT,
    "subRegionId" TEXT,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitCode" VARCHAR(5) NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "cityId" TEXT NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campus" (
    "id" SERIAL NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "name" TEXT NOT NULL,
    "campusCode" TEXT NOT NULL,
    "campusSlug" TEXT NOT NULL,
    "unitCode" VARCHAR(5) NOT NULL,
    "fullUnitPath" VARCHAR(50) NOT NULL,
    "address" TEXT,
    "cityId" TEXT NOT NULL,
    "zoneId" TEXT,
    "principalName" TEXT,
    "contactPhone" TEXT,
    "email" TEXT,
    "academicStartMonth" INTEGER NOT NULL DEFAULT 8,
    "isMainCampus" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitProfile" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "unitType" "UnitScopeType" NOT NULL,
    "unitId" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitContact" (
    "id" TEXT NOT NULL,
    "unitProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitAddress" (
    "id" TEXT NOT NULL,
    "unitProfileId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitBankAccount" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "unitProfileId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branchName" TEXT,
    "branchCode" TEXT,
    "accountTitle" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "iban" VARCHAR(34),
    "swiftCode" VARCHAR(11),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "campusId" INTEGER,
    "unitId" TEXT,
    "unitPath" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "token" TEXT NOT NULL,
    "invitedById" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "feeStatus" TEXT NOT NULL DEFAULT 'Unpaid',
    "organizationId" VARCHAR(11) NOT NULL,
    "campusId" INTEGER NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFinancialSummary" (
    "studentId" INTEGER NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "campusId" INTEGER NOT NULL,
    "totalDebit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCredit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFinancialSummary_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "AcademicYearStatus" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "displayOrder" INTEGER,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "classTeacherId" INTEGER,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEnrollment" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "studentId" INTEGER NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "rollNumber" TEXT,
    "admissionDate" TIMESTAMP(3),
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "promotedFromId" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remarks" TEXT,
    "markedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "name" TEXT NOT NULL,
    "examType" "ExamType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalMarks" DECIMAL(8,2),
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSubject" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "totalMarks" DECIMAL(6,2) NOT NULL,
    "passingMarks" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "ExamSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentExamResult" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "obtainedMarks" DECIMAL(6,2) NOT NULL,
    "grade" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeScale" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "name" TEXT NOT NULL,
    "minPercentage" DECIMAL(5,2) NOT NULL,
    "maxPercentage" DECIMAL(5,2) NOT NULL,
    "grade" TEXT NOT NULL,
    "gradePoint" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRun" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "fromAcademicYearId" TEXT NOT NULL,
    "toAcademicYearId" TEXT NOT NULL,
    "status" "PromotionRunStatus" NOT NULL DEFAULT 'PENDING',
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "promoted" INTEGER NOT NULL DEFAULT 0,
    "retained" INTEGER NOT NULL DEFAULT 0,
    "graduated" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "initiatedByUserId" INTEGER NOT NULL,

    CONSTRAINT "PromotionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostingRun" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "campusId" INTEGER,
    "academicYearId" TEXT,
    "status" "PostingRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "totalChallans" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdByUserId" INTEGER,

    CONSTRAINT "PostingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "campusId" INTEGER,
    "name" TEXT NOT NULL,
    "triggerType" "ReminderTriggerType" NOT NULL DEFAULT 'AFTER_DUE',
    "daysOffset" INTEGER NOT NULL DEFAULT 0,
    "minDaysOverdue" INTEGER NOT NULL,
    "maxDaysOverdue" INTEGER,
    "channel" "ReminderChannel" NOT NULL,
    "templateKey" TEXT,
    "template" TEXT NOT NULL,
    "frequencyDays" INTEGER NOT NULL DEFAULT 7,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "studentId" INTEGER NOT NULL,
    "challanId" INTEGER,
    "reminderRuleId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "triggerType" "ReminderTriggerType",
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReminderStatus" NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "messageBody" TEXT,
    "paymentLink" TEXT,
    "externalRef" TEXT,
    "errorDetail" TEXT,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeHead" (
    "id" SERIAL NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" SERIAL NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "campusId" INTEGER NOT NULL,
    "feeHeadId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "frequency" "FeeFrequency" NOT NULL DEFAULT 'MONTHLY',
    "applicableGrade" TEXT,
    "startMonth" INTEGER,
    "endMonth" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeChallan" (
    "id" SERIAL NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "campusId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "challanNo" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "status" "ChallanStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "generatedBy" TEXT NOT NULL,
    "month" INTEGER,
    "year" INTEGER,
    "feeStructureId" INTEGER,
    "academicYearId" TEXT,
    "bankAccountId" TEXT,

    CONSTRAINT "FeeChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationPaymentConfig" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "primaryGateway" "PaymentGateway" NOT NULL DEFAULT 'MANUAL',
    "enabledJson" JSONB NOT NULL DEFAULT '[]',
    "configJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPaymentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "bankAccountId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "transactionRef" TEXT,
    "paymentChannel" "PaymentChannel" NOT NULL,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'MANUAL',
    "gatewayRef" TEXT,
    "gatewayPayload" JSONB,
    "paidAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "rawPayload" JSONB,
    "challanId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "studentId" INTEGER,
    "campusId" INTEGER,
    "challanId" INTEGER,
    "entryType" "LedgerEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "notes" TEXT,
    "academicYearId" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "queue" TEXT NOT NULL DEFAULT 'default',
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "progress" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "result" JSONB,
    "idempotencyKey" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "organizationId" VARCHAR(11),
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "type" "MediaType" NOT NULL,
    "variant" "MediaVariant" NOT NULL DEFAULT 'ORIGINAL',
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "originalName" TEXT,
    "createdBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RbacAuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorUserId" INTEGER NOT NULL,
    "targetUserId" INTEGER NOT NULL,
    "membershipId" INTEGER NOT NULL,
    "oldRole" "MembershipRole",
    "newRole" "MembershipRole",
    "oldUnitPath" VARCHAR(50),
    "newUnitPath" VARCHAR(50),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RbacAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEventLog" (
    "id" TEXT NOT NULL,
    "organizationId" VARCHAR(11) NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "initiatedByUserId" INTEGER,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailVerifyToken_key" ON "User"("emailVerifyToken");

-- CreateIndex
CREATE INDEX "VerificationCode_userId_channel_target_idx" ON "VerificationCode"("userId", "channel", "target");

-- CreateIndex
CREATE INDEX "OtpSession_phone_idx" ON "OtpSession"("phone");

-- CreateIndex
CREATE INDEX "OtpSession_expiresAt_idx" ON "OtpSession"("expiresAt");

-- CreateIndex
CREATE INDEX "OtpSession_ipAddress_idx" ON "OtpSession"("ipAddress");

-- CreateIndex
CREATE INDEX "QrToken_organizationId_type_idx" ON "QrToken"("organizationId", "type");

-- CreateIndex
CREATE INDEX "QrToken_type_referenceId_idx" ON "QrToken"("type", "referenceId");

-- CreateIndex
CREATE INDEX "QrToken_referenceId_idx" ON "QrToken"("referenceId");

-- CreateIndex
CREATE INDEX "DashboardAction_organizationId_role_enabled_idx" ON "DashboardAction"("organizationId", "role", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardAction_organizationId_role_actionKey_key" ON "DashboardAction"("organizationId", "role", "actionKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPlan_organizationId_key" ON "OrganizationPlan"("organizationId");

-- CreateIndex
CREATE INDEX "PlanFeature_planType_idx" ON "PlanFeature"("planType");

-- CreateIndex
CREATE UNIQUE INDEX "PlanFeature_planType_featureKey_key" ON "PlanFeature"("planType", "featureKey");

-- CreateIndex
CREATE INDEX "FeeTemplate_organizationId_isActive_idx" ON "FeeTemplate"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FeeTemplate_organizationId_name_key" ON "FeeTemplate"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CampusHealthScore_campusId_key" ON "CampusHealthScore"("campusId");

-- CreateIndex
CREATE UNIQUE INDEX "CampusHealthScore_organizationId_campusId_key" ON "CampusHealthScore"("organizationId", "campusId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "OrganizationContact_organizationId_idx" ON "OrganizationContact"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationAddress_organizationId_idx" ON "OrganizationAddress"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationBank_organizationId_idx" ON "OrganizationBank"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitCodeSequence_organizationId_scopeType_scopeId_key" ON "UnitCodeSequence"("organizationId", "scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "Region_organizationId_unitCode_key" ON "Region"("organizationId", "unitCode");

-- CreateIndex
CREATE UNIQUE INDEX "SubRegion_organizationId_regionId_unitCode_key" ON "SubRegion"("organizationId", "regionId", "unitCode");

-- CreateIndex
CREATE UNIQUE INDEX "City_organizationId_unitCode_key" ON "City"("organizationId", "unitCode");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_organizationId_cityId_unitCode_key" ON "Zone"("organizationId", "cityId", "unitCode");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_campusCode_key" ON "Campus"("campusCode");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_campusSlug_key" ON "Campus"("campusSlug");

-- CreateIndex
CREATE INDEX "Campus_fullUnitPath_idx" ON "Campus"("fullUnitPath");

-- CreateIndex
CREATE INDEX "UnitProfile_organizationId_idx" ON "UnitProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitProfile_unitType_unitId_key" ON "UnitProfile"("unitType", "unitId");

-- CreateIndex
CREATE INDEX "UnitContact_unitProfileId_idx" ON "UnitContact"("unitProfileId");

-- CreateIndex
CREATE INDEX "UnitAddress_unitProfileId_idx" ON "UnitAddress"("unitProfileId");

-- CreateIndex
CREATE INDEX "UnitBankAccount_organizationId_idx" ON "UnitBankAccount"("organizationId");

-- CreateIndex
CREATE INDEX "UnitBankAccount_unitProfileId_idx" ON "UnitBankAccount"("unitProfileId");

-- CreateIndex
CREATE INDEX "UnitBankAccount_status_idx" ON "UnitBankAccount"("status");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE INDEX "Membership_unitPath_idx" ON "Membership"("unitPath");

-- CreateIndex
CREATE INDEX "Membership_role_unitPath_idx" ON "Membership"("role", "unitPath");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Student_admissionNo_key" ON "Student"("admissionNo");

-- CreateIndex
CREATE INDEX "StudentFinancialSummary_organizationId_idx" ON "StudentFinancialSummary"("organizationId");

-- CreateIndex
CREATE INDEX "StudentFinancialSummary_organizationId_campusId_idx" ON "StudentFinancialSummary"("organizationId", "campusId");

-- CreateIndex
CREATE INDEX "StudentFinancialSummary_balance_idx" ON "StudentFinancialSummary"("balance");

-- CreateIndex
CREATE INDEX "AcademicYear_organizationId_isActive_idx" ON "AcademicYear"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_organizationId_name_key" ON "AcademicYear"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Class_organizationId_academicYearId_idx" ON "Class"("organizationId", "academicYearId");

-- CreateIndex
CREATE INDEX "Class_campusId_academicYearId_idx" ON "Class"("campusId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Class_academicYearId_campusId_name_key" ON "Class"("academicYearId", "campusId", "name");

-- CreateIndex
CREATE INDEX "Section_organizationId_academicYearId_idx" ON "Section"("organizationId", "academicYearId");

-- CreateIndex
CREATE INDEX "Section_campusId_academicYearId_idx" ON "Section"("campusId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_classId_name_key" ON "Section"("classId", "name");

-- CreateIndex
CREATE INDEX "StudentEnrollment_organizationId_academicYearId_idx" ON "StudentEnrollment"("organizationId", "academicYearId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_campusId_academicYearId_idx" ON "StudentEnrollment"("campusId", "academicYearId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_classId_idx" ON "StudentEnrollment"("classId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_sectionId_idx" ON "StudentEnrollment"("sectionId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_status_idx" ON "StudentEnrollment"("status");

-- CreateIndex
CREATE INDEX "StudentEnrollment_promotedFromId_idx" ON "StudentEnrollment"("promotedFromId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEnrollment_studentId_academicYearId_key" ON "StudentEnrollment"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "Attendance_organizationId_academicYearId_idx" ON "Attendance"("organizationId", "academicYearId");

-- CreateIndex
CREATE INDEX "Attendance_sectionId_date_idx" ON "Attendance"("sectionId", "date");

-- CreateIndex
CREATE INDEX "Attendance_studentId_date_idx" ON "Attendance"("studentId", "date");

-- CreateIndex
CREATE INDEX "Attendance_campusId_date_idx" ON "Attendance"("campusId", "date");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_enrollmentId_date_key" ON "Attendance"("enrollmentId", "date");

-- CreateIndex
CREATE INDEX "Subject_organizationId_academicYearId_idx" ON "Subject"("organizationId", "academicYearId");

-- CreateIndex
CREATE INDEX "Subject_classId_idx" ON "Subject"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_academicYearId_classId_name_key" ON "Subject"("academicYearId", "classId", "name");

-- CreateIndex
CREATE INDEX "Exam_organizationId_academicYearId_idx" ON "Exam"("organizationId", "academicYearId");

-- CreateIndex
CREATE INDEX "Exam_campusId_academicYearId_idx" ON "Exam"("campusId", "academicYearId");

-- CreateIndex
CREATE INDEX "Exam_classId_idx" ON "Exam"("classId");

-- CreateIndex
CREATE INDEX "Exam_status_idx" ON "Exam"("status");

-- CreateIndex
CREATE INDEX "ExamSubject_examId_idx" ON "ExamSubject"("examId");

-- CreateIndex
CREATE INDEX "ExamSubject_subjectId_idx" ON "ExamSubject"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubject_examId_subjectId_key" ON "ExamSubject"("examId", "subjectId");

-- CreateIndex
CREATE INDEX "StudentExamResult_examId_idx" ON "StudentExamResult"("examId");

-- CreateIndex
CREATE INDEX "StudentExamResult_enrollmentId_idx" ON "StudentExamResult"("enrollmentId");

-- CreateIndex
CREATE INDEX "StudentExamResult_studentId_academicYearId_idx" ON "StudentExamResult"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentExamResult_examSubjectId_enrollmentId_key" ON "StudentExamResult"("examSubjectId", "enrollmentId");

-- CreateIndex
CREATE INDEX "GradeScale_organizationId_idx" ON "GradeScale"("organizationId");

-- CreateIndex
CREATE INDEX "GradeScale_organizationId_minPercentage_idx" ON "GradeScale"("organizationId", "minPercentage");

-- CreateIndex
CREATE INDEX "PromotionRun_organizationId_idx" ON "PromotionRun"("organizationId");

-- CreateIndex
CREATE INDEX "PromotionRun_status_idx" ON "PromotionRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRun_organizationId_fromAcademicYearId_key" ON "PromotionRun"("organizationId", "fromAcademicYearId");

-- CreateIndex
CREATE INDEX "PostingRun_organizationId_idx" ON "PostingRun"("organizationId");

-- CreateIndex
CREATE INDEX "PostingRun_status_idx" ON "PostingRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PostingRun_organizationId_month_year_key" ON "PostingRun"("organizationId", "month", "year");

-- CreateIndex
CREATE INDEX "ReminderRule_organizationId_isActive_idx" ON "ReminderRule"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "ReminderLog_studentId_reminderRuleId_sentAt_idx" ON "ReminderLog"("studentId", "reminderRuleId", "sentAt");

-- CreateIndex
CREATE INDEX "ReminderLog_externalRef_idx" ON "ReminderLog"("externalRef");

-- CreateIndex
CREATE INDEX "ReminderLog_organizationId_idx" ON "ReminderLog"("organizationId");

-- CreateIndex
CREATE INDEX "ReminderLog_challanId_idx" ON "ReminderLog"("challanId");

-- CreateIndex
CREATE INDEX "MessageTemplate_organizationId_channel_idx" ON "MessageTemplate"("organizationId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_organizationId_channel_templateKey_key" ON "MessageTemplate"("organizationId", "channel", "templateKey");

-- CreateIndex
CREATE INDEX "FeeStructure_organizationId_isActive_idx" ON "FeeStructure"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FeeChallan_challanNo_key" ON "FeeChallan"("challanNo");

-- CreateIndex
CREATE INDEX "FeeChallan_bankAccountId_idx" ON "FeeChallan"("bankAccountId");

-- CreateIndex
CREATE INDEX "FeeChallan_organizationId_idx" ON "FeeChallan"("organizationId");

-- CreateIndex
CREATE INDEX "FeeChallan_studentId_idx" ON "FeeChallan"("studentId");

-- CreateIndex
CREATE INDEX "FeeChallan_status_idx" ON "FeeChallan"("status");

-- CreateIndex
CREATE INDEX "FeeChallan_feeStructureId_idx" ON "FeeChallan"("feeStructureId");

-- CreateIndex
CREATE INDEX "FeeChallan_academicYearId_idx" ON "FeeChallan"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeChallan_studentId_month_year_feeStructureId_key" ON "FeeChallan"("studentId", "month", "year", "feeStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPaymentConfig_organizationId_key" ON "OrganizationPaymentConfig"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentRecord_organizationId_idx" ON "PaymentRecord"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentRecord_transactionRef_idx" ON "PaymentRecord"("transactionRef");

-- CreateIndex
CREATE INDEX "PaymentRecord_challanId_idx" ON "PaymentRecord"("challanId");

-- CreateIndex
CREATE INDEX "PaymentRecord_status_idx" ON "PaymentRecord"("status");

-- CreateIndex
CREATE INDEX "PaymentRecord_gatewayRef_idx" ON "PaymentRecord"("gatewayRef");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_gateway_gatewayRef_key" ON "PaymentRecord"("gateway", "gatewayRef");

-- CreateIndex
CREATE INDEX "LedgerEntry_organizationId_studentId_idx" ON "LedgerEntry"("organizationId", "studentId");

-- CreateIndex
CREATE INDEX "LedgerEntry_studentId_entryDate_idx" ON "LedgerEntry"("studentId", "entryDate");

-- CreateIndex
CREATE INDEX "LedgerEntry_challanId_idx" ON "LedgerEntry"("challanId");

-- CreateIndex
CREATE INDEX "LedgerEntry_campusId_idx" ON "LedgerEntry"("campusId");

-- CreateIndex
CREATE INDEX "LedgerEntry_entryType_idx" ON "LedgerEntry"("entryType");

-- CreateIndex
CREATE INDEX "LedgerEntry_academicYearId_idx" ON "LedgerEntry"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_idempotencyKey_key" ON "Job"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Job_status_scheduledAt_idx" ON "Job"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Job_type_status_idx" ON "Job"("type", "status");

-- CreateIndex
CREATE INDEX "Job_organizationId_idx" ON "Job"("organizationId");

-- CreateIndex
CREATE INDEX "Job_queue_priority_idx" ON "Job"("queue", "priority");

-- CreateIndex
CREATE INDEX "Job_referenceId_referenceType_idx" ON "Job"("referenceId", "referenceType");

-- CreateIndex
CREATE INDEX "MediaAsset_organizationId_type_idx" ON "MediaAsset"("organizationId", "type");

-- CreateIndex
CREATE INDEX "MediaAsset_organizationId_type_variant_idx" ON "MediaAsset"("organizationId", "type", "variant");

-- CreateIndex
CREATE INDEX "RbacAuditLog_organizationId_createdAt_idx" ON "RbacAuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "RbacAuditLog_membershipId_idx" ON "RbacAuditLog"("membershipId");

-- CreateIndex
CREATE INDEX "RbacAuditLog_targetUserId_idx" ON "RbacAuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "DomainEventLog_organizationId_eventType_idx" ON "DomainEventLog"("organizationId", "eventType");

-- CreateIndex
CREATE INDEX "DomainEventLog_eventType_processed_idx" ON "DomainEventLog"("eventType", "processed");

-- CreateIndex
CREATE INDEX "DomainEventLog_occurredAt_idx" ON "DomainEventLog"("occurredAt");

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrToken" ADD CONSTRAINT "QrToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardAction" ADD CONSTRAINT "DashboardAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPlan" ADD CONSTRAINT "OrganizationPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationControlPolicy" ADD CONSTRAINT "OrganizationControlPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeTemplate" ADD CONSTRAINT "FeeTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusHealthScore" ADD CONSTRAINT "CampusHealthScore_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusHealthScore" ADD CONSTRAINT "CampusHealthScore_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusOperationalStatus" ADD CONSTRAINT "CampusOperationalStatus_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationContact" ADD CONSTRAINT "OrganizationContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAddress" ADD CONSTRAINT "OrganizationAddress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationBank" ADD CONSTRAINT "OrganizationBank_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitCodeSequence" ADD CONSTRAINT "UnitCodeSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubRegion" ADD CONSTRAINT "SubRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubRegion" ADD CONSTRAINT "SubRegion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_subRegionId_fkey" FOREIGN KEY ("subRegionId") REFERENCES "SubRegion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitProfile" ADD CONSTRAINT "UnitProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitContact" ADD CONSTRAINT "UnitContact_unitProfileId_fkey" FOREIGN KEY ("unitProfileId") REFERENCES "UnitProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitAddress" ADD CONSTRAINT "UnitAddress_unitProfileId_fkey" FOREIGN KEY ("unitProfileId") REFERENCES "UnitProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitBankAccount" ADD CONSTRAINT "UnitBankAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitBankAccount" ADD CONSTRAINT "UnitBankAccount_unitProfileId_fkey" FOREIGN KEY ("unitProfileId") REFERENCES "UnitProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialSummary" ADD CONSTRAINT "StudentFinancialSummary_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialSummary" ADD CONSTRAINT "StudentFinancialSummary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_promotedFromId_fkey" FOREIGN KEY ("promotedFromId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamResult" ADD CONSTRAINT "StudentExamResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamResult" ADD CONSTRAINT "StudentExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamResult" ADD CONSTRAINT "StudentExamResult_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExamSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamResult" ADD CONSTRAINT "StudentExamResult_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamResult" ADD CONSTRAINT "StudentExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeScale" ADD CONSTRAINT "GradeScale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRun" ADD CONSTRAINT "PromotionRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRun" ADD CONSTRAINT "PromotionRun_fromAcademicYearId_fkey" FOREIGN KEY ("fromAcademicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRun" ADD CONSTRAINT "PromotionRun_toAcademicYearId_fkey" FOREIGN KEY ("toAcademicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRun" ADD CONSTRAINT "PromotionRun_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRun" ADD CONSTRAINT "PostingRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRun" ADD CONSTRAINT "PostingRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostingRun" ADD CONSTRAINT "PostingRun_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "FeeChallan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_reminderRuleId_fkey" FOREIGN KEY ("reminderRuleId") REFERENCES "ReminderRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeHead" ADD CONSTRAINT "FeeHead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_feeHeadId_fkey" FOREIGN KEY ("feeHeadId") REFERENCES "FeeHead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeChallan" ADD CONSTRAINT "FeeChallan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeChallan" ADD CONSTRAINT "FeeChallan_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeChallan" ADD CONSTRAINT "FeeChallan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeChallan" ADD CONSTRAINT "FeeChallan_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeChallan" ADD CONSTRAINT "FeeChallan_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeChallan" ADD CONSTRAINT "FeeChallan_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "UnitBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPaymentConfig" ADD CONSTRAINT "OrganizationPaymentConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "UnitBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "FeeChallan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "FeeChallan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RbacAuditLog" ADD CONSTRAINT "RbacAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RbacAuditLog" ADD CONSTRAINT "RbacAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RbacAuditLog" ADD CONSTRAINT "RbacAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEventLog" ADD CONSTRAINT "DomainEventLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
