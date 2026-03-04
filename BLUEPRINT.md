# SAIREX SMS — Full Project Blueprint (AI Reference)

> **Last updated:** 2026-02-26
> **Purpose:** Canonical reference for any AI assistant continuing development on this project.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Multi-Tenant Architecture](#6-multi-tenant-architecture)
7. [Onboarding Flow](#7-onboarding-flow)
8. [API Routes Reference](#8-api-routes-reference)
9. [Background Job System](#9-background-job-system)
10. [Event-Driven Architecture](#10-event-driven-architecture)
11. [Financial Engine](#11-financial-engine)
12. [Academic Engine](#12-academic-engine)
13. [Adoption Layer](#13-adoption-layer)
14. [Payment Gateway Integration](#14-payment-gateway-integration)
15. [Chain Governance (Master Control Panel)](#15-chain-governance-master-control-panel)
16. [Launch Readiness](#16-launch-readiness)
17. [PDF Generation](#17-pdf-generation)
18. [UI Component System](#18-ui-component-system)
19. [Validation Layer](#19-validation-layer)
20. [Admin Pages](#20-admin-pages)
21. [Navigation & Sidebar](#21-navigation--sidebar)
22. [External Services](#22-external-services)
23. [Environment Variables](#23-environment-variables)
24. [Scripts & Tooling](#24-scripts--tooling)
25. [Enterprise Media Asset System](#25-enterprise-media-asset-system)
26. [Registration Certificate PDF System](#26-registration-certificate-pdf-system)
27. [Known Issues & Technical Debt](#27-known-issues--technical-debt)
28. [Coding Standards (Enforced Rules)](#28-coding-standards-enforced-rules)
29. [Phase 8 Completion + Phase 9 Revenue Optimization (Step 1)](#29-phase-8-completion--phase-9-revenue-optimization-step-1)
30. [Production Release & Rollback Runbook](#30-production-release--rollback-runbook)
31. [Step 9 Controlled Theme Migration Plan](#31-step-9-controlled-theme-migration-plan)
32. [Theming Phase Complete + Governance Lock Roadmap](#32-theming-phase-complete--governance-lock-roadmap)
33. [UI Governance Law (Enforced)](#33-ui-governance-law-enforced)

---

## 1. Project Overview

**SAIREX SMS** (Smart Management System) is an enterprise multi-tenant SaaS ERP for educational institutions (schools, colleges, academies, universities). It handles:

- **Organization onboarding** — multi-step registration with identity, legal, address, branding, and OTP verification
- **Multi-campus management** — hierarchical structure: Organization → Region → SubRegion → Zone → Campus
- **Student management** — admission, year-aware enrollment, promotion, transfer
- **Academic engine** — academic years, classes, sections, attendance, exams, results, grading, promotion
- **Fee management** — fee heads, structures, automated posting, challan generation, bank routing, reconciliation
- **Financial ledger** — double-sided ledger, balance computation, aging, defaulter detection
- **Payment gateway integration** — EasyPaisa, JazzCash, 1Bill, Stripe adapters with webhook processing
- **Automated reminders** — multi-channel (SMS/WhatsApp) reminders triggered by aging, with payment links
- **User management** — RBAC with invites, role assignment, campus-level permissions, phone-first auth
- **Background jobs** — 15 BullMQ queues for async email, SMS, WhatsApp, PDF, finance, promotion, events
- **Event-driven architecture** — domain event bus with typed payloads, sync/async handlers, persisted event log
- **Adoption layer** — passwordless phone auth, QR token infrastructure, guided setup wizard, role-based dashboard
- **Chain governance** — master control panel for 20+ campus chains with health scoring, policy enforcement, campus locks
- **Launch readiness** — feature gating (internal FREE/BASIC/PRO/ENTERPRISE + public STARTER/PROFESSIONAL/ENTERPRISE), pricing architecture, trials, encryption, rate limiting, health checks

**Domain:** `sairex-sms.com`
**Brand:** Sairex Technologies

---

## 2. Tech Stack

### Core

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22.22.0 LTS (pinned in `.nvmrc`) |
| Framework | Next.js (App Router) | 16.1.6 (Turbopack dev) |
| Language | TypeScript | ^5 |
| React | React + React DOM | 19.2.3 |
| Database | PostgreSQL | localhost:5432, database: `sairex_db` |
| ORM | Prisma | ^5.17.0 |
| Auth | NextAuth.js v5 (beta) | ^5.0.0-beta.30 |
| Styling | Tailwind CSS v4 | ^4 |
| UI Library | Shadcn UI + custom Sx components | ^3.8.5 |

### Background Jobs & Events

| Component | Technology | Version |
|-----------|-----------|---------|
| Queue Engine | BullMQ | ^5.69.3 |
| Redis Client | ioredis | ^5.9.3 |
| Redis Server | Memurai (Windows, Redis 7.2.5 compat) | local |
| Event IDs | @paralleldrive/cuid2 | latest |

### External Services

| Service | Technology | Purpose |
|---------|-----------|---------|
| Email | Nodemailer → Titan Email SMTP | Transactional email |
| SMS | Axios → Veevo Tech API | SMS delivery |
| WhatsApp | whatsapp-web.js (Puppeteer) | WhatsApp messaging (dev); WhatsApp Cloud API (production) |
| PDF | @react-pdf/renderer (certificates) + PDFKit (challans) | Registration certificates, challans, reports |
| File Storage | AWS S3 + sharp (WEBP optimization) | Logo & media asset upload with variants |
| Encryption | Node.js crypto (AES-256-GCM) | Sensitive config field encryption |

### Forms & Validation

| Component | Version |
|-----------|---------|
| react-hook-form | ^7.71.1 |
| @hookform/resolvers | ^5.2.2 |
| Zod | ^4.3.6 |

---

## 3. Repository Structure

```
c:\SairexSMS\
├── .cursor/rules/               # AI enforced coding rules
│   ├── sairex-component-standards.mdc
│   └── sairex-api-patterns.mdc
├── .nvmrc                       # Node 22.22.0
├── prisma/
│   └── schema.prisma            # Single source of truth for DB schema
├── backend/                     # Python scripts (legacy/utility)
└── web/                         # Next.js application (main codebase)
    ├── package.json
    ├── tsconfig.json
    ├── next.config.ts
    ├── auth.ts                  # NextAuth configuration
    ├── auth.config.ts           # NextAuth edge config
    ├── instrumentation.ts       # Worker bootstrap hook
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── globals.css
    │   ├── (auth)/              # Auth route group (login, signup, forgot/reset password, verify)
    │   ├── onboarding/          # Multi-step org onboarding (identity, legal, contact-address, branding, preview, confirmation)
    │   ├── admin/               # Protected admin panel (dashboard, orgs, regions, campuses, students, users, finance, jobs, audit, dev-tools)
    │   └── api/
    │       ├── auth/            # NextAuth + signup, verify, password flows
    │       ├── onboarding/      # Onboarding steps + OTP verification + certificate
    │       ├── organizations/   # Org CRUD + contacts, addresses, banks
    │       ├── regions/         # Geo hierarchy CRUD
    │       ├── campuses/        # Campus CRUD
    │       ├── students/        # Student admission
    │       ├── invites/         # Invite system
    │       ├── memberships/     # Membership management
    │       ├── unit-profiles/   # Unit profile CRUD
    │       ├── finance/         # Fee heads, structures, challans
    │       ├── jobs/            # Job monitor + enqueue endpoints
    │       ├── cron/            # Scheduled triggers
    │       ├── health/          # Health check endpoints (db, redis)
    │       ├── dashboard/       # Dashboard action registry
    │       ├── qr/              # QR token resolution
    │       ├── payments/        # Payment initiation, webhooks, config
    │       ├── reminders/       # Reminder templates
    │       ├── governance/      # Control policy, dashboard, campus-lock, health-scores, fee-templates
    │       ├── webhooks/        # External webhooks (WhatsApp delivery)
    │       ├── dev-tools/       # SUPER_ADMIN utilities
    │       └── media/           # Media upload (logo, assets)
    ├── components/
    │   ├── sx/                  # Custom SAIREX design system
    │   ├── ui/                  # Shadcn UI primitives
    │   └── theme-provider.tsx
    ├── lib/
    │   ├── prisma.ts            # Singleton PrismaClient
    │   ├── api-client.ts        # Client-side API wrapper (discriminated union)
    │   ├── auth-guard.ts        # requireAuth, requireRole, isSuperAdmin
    │   ├── tenant.ts            # scopeFilter, resolveOrgId, validateCrossRefs, assertOwnership
    │   ├── feature-gate.ts      # Plan-based feature gating (assertFeatureEnabled)
    │   ├── encryption.ts        # AES-256-GCM encrypt/decrypt for secrets
    │   ├── rate-limit.ts        # Sliding-window rate limiter
    │   ├── security.ts          # Tenant assertion, webhook replay protection, security headers
    │   ├── email.ts             # Nodemailer transport
    │   ├── whatsapp.ts          # whatsapp-web.js client
    │   ├── notifications.ts     # notifyParent → enqueues NOTIFICATION job
    │   ├── id-generators.ts     # generateOrganizationId (ORG-XXXXX)
    │   ├── unit-code.ts         # Unit code generation + fullUnitPath
    │   ├── config/
    │   │   └── theme.ts
    │   ├── data/
    │   │   └── pakistan-geo.ts
    │   ├── validations/         # Zod schemas
    │   ├── pdf/                 # Server-side PDF generation
    │   ├── queue/               # BullMQ job system (15 queues)
    │   │   ├── connection.ts    # Redis singleton
    │   │   ├── queues.ts        # Queue constants + factory
    │   │   ├── enqueue.ts       # Dual-write (Postgres + BullMQ)
    │   │   ├── recovery.ts      # Stuck/failed job recovery
    │   │   ├── index.ts
    │   │   └── workers/         # 15 queue workers
    │   │       ├── index.ts     # Bootstrap all workers
    │   │       ├── email.worker.ts
    │   │       ├── otp.worker.ts
    │   │       ├── sms.worker.ts
    │   │       ├── whatsapp.worker.ts
    │   │       ├── notification.worker.ts
    │   │       ├── challan-pdf.worker.ts
    │   │       ├── report.worker.ts
    │   │       ├── bulk-sms.worker.ts
    │   │       ├── import.worker.ts
    │   │       ├── finance.worker.ts
    │   │       ├── promotion.worker.ts
    │   │       ├── reminder.worker.ts
    │   │       ├── system.worker.ts
    │   │       ├── webhook.worker.ts
    │   │       └── event-handler.worker.ts
    │   ├── events/              # Event-driven architecture
    │   │   ├── bus.ts           # Event bus (dispatch, sync/async handlers)
    │   │   ├── types.ts         # All domain event types + payload interfaces
    │   │   ├── registry.ts      # Handler registration
    │   │   └── index.ts
    │   ├── finance/             # Financial engine services
    │   │   ├── challan-routing.service.ts    # Bank auto-routing (campus → hierarchy)
    │   │   ├── reconciliation.service.ts     # Payment reconciliation + ledger
    │   │   ├── student-ledger.service.ts     # Balance computation, aging, defaulters
    │   │   ├── fee-posting.service.ts        # Automated monthly/term fee posting
    │   │   ├── defaulter.service.ts          # Defaulter & aging analytics
    │   │   └── reminder-engine.service.ts    # Automated collection reminders
    │   ├── academic/            # Academic engine services
    │   │   ├── academic-year.service.ts      # Year lifecycle (DRAFT→ACTIVE→CLOSED)
    │   │   ├── class-section.service.ts      # Year-aware class & section CRUD
    │   │   ├── enrollment.service.ts         # Student enrollment + transfers
    │   │   ├── attendance.service.ts         # Bulk attendance marking
    │   │   ├── exam.service.ts              # Exam & result management
    │   │   └── promotion.service.ts         # Academic year rollover + promotion
    │   ├── adoption/            # Adoption layer services
    │   │   ├── otp.service.ts               # Passwordless phone-first auth
    │   │   ├── qr-token.service.ts          # QR token generation & resolution
    │   │   ├── onboarding.service.ts        # Wizard step tracking
    │   │   ├── bootstrap.service.ts         # Organization auto-setup
    │   │   ├── dashboard.service.ts         # Role-based action dashboard
    │   │   └── index.ts
    │   ├── payments/            # Payment gateway abstraction
    │   │   ├── gateway.interface.ts         # PaymentGatewayAdapter interface
    │   │   ├── payment.service.ts           # Orchestration (initiate, webhook processing)
    │   │   ├── adapters/
    │   │   │   ├── manual.adapter.ts
    │   │   │   ├── easypaisa.adapter.ts
    │   │   │   ├── jazzcash.adapter.ts
    │   │   │   ├── onebill.adapter.ts
    │   │   │   └── stripe.adapter.ts
    │   │   └── index.ts
    │   ├── governance/          # Chain governance services
    │   │   ├── control-policy.service.ts    # Policy enforcement + campus locks
    │   │   ├── campus-health.service.ts     # Composite health score computation
    │   │   ├── master-dashboard.service.ts  # Chain KPIs + campus comparison
    │   │   └── index.ts
    │   ├── analytics/           # BI & analytics
    │   │   └── access-coverage.service.ts
    │   └── generated/
    │       └── prisma/          # Prisma generated client (gitignored)
    ├── scripts/
    │   ├── seed-admin.ts
    │   ├── seed-plan-features.ts   # Seed feature gating matrix
    │   ├── start-workers.ts
    │   └── test-*.ts
    └── public/
        └── generated/           # Runtime-generated PDFs
```

---

## 4. Database Schema

### Prisma Configuration

```prisma
generator client {
  provider = "prisma-client-py"
}

generator jsClient {
  provider = "prisma-client-js"
  output   = "../web/lib/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Important:** Schema at `prisma/schema.prisma` (repo root), JS client generated to `web/lib/generated/prisma/`. Import: `from "@/lib/generated/prisma"`.

### Enums (35+)

| Category | Enum | Values |
|----------|------|--------|
| **Auth** | `PlatformRole` | SUPER_ADMIN, SUPPORT |
| | `MembershipRole` | ORG_ADMIN, CAMPUS_ADMIN, TEACHER, ACCOUNTANT, PARENT, STAFF |
| | `MembershipStatus` | ACTIVE, INVITED, SUSPENDED |
| **Organization** | `OrganizationCategory` | SCHOOL, COLLEGE, ACADEMY, INSTITUTE, UNIVERSITY, OTHERS |
| | `OrganizationStructure` | SINGLE, MULTIPLE |
| | `OrganizationStatus` | ACTIVE, SUSPENDED, ARCHIVED |
| | `OnboardingStep` | ORG_IDENTITY, LEGAL, CONTACT_ADDRESS, BRANDING, COMPLETED |
| **Geo** | `UnitScopeType` | REGION, SUBREGION, CITY, ZONE, CAMPUS |
| | `AddressType` | HEAD_OFFICE, BILLING, CAMPUS, OTHER |
| **Finance** | `FinanceRoutingMode` | CAMPUS_PRIMARY, NEAREST_PARENT_PRIMARY |
| | `ChallanStatus` | UNPAID, PARTIALLY_PAID, PAID, CANCELLED |
| | `PaymentStatus` | PENDING, RECONCILED, FAILED, REFUNDED |
| | `PaymentChannel` | CASH, BANK_TRANSFER, ONLINE, CHEQUE |
| | `LedgerEntryType` | CHALLAN_CREATED, PAYMENT_RECEIVED, ADJUSTMENT, REFUND, WAIVER |
| | `LedgerDirection` | DEBIT, CREDIT |
| | `FeeFrequency` | MONTHLY, TERM, ANNUAL |
| | `PostingRunStatus` | PENDING, PROCESSING, COMPLETED, FAILED |
| | `PaymentGateway` | EASYPAISA, JAZZCASH, ONEBILL, KUICKPAY, STRIPE, MANUAL |
| **Academic** | `AcademicYearStatus` | DRAFT, ACTIVE, CLOSED, ARCHIVED |
| | `EnrollmentStatus` | ACTIVE, TRANSFERRED, WITHDRAWN, COMPLETED, REPEATED |
| | `AttendanceStatus` | PRESENT, ABSENT, LATE, LEAVE, HALF_DAY |
| | `ExamType` | UNIT_TEST, MID_TERM, FINAL, TERM, ANNUAL |
| | `ExamStatus` | DRAFT, ACTIVE, LOCKED, PUBLISHED |
| | `PromotionStatus` | PENDING, PROCESSING, COMPLETED, FAILED |
| **Reminders** | `ReminderChannel` | SMS, WHATSAPP, EMAIL |
| | `ReminderStatus` | SENT, FAILED, DELIVERED, READ |
| | `ReminderTriggerType` | BEFORE_DUE, AFTER_DUE, PARTIAL_PAYMENT, FINAL_NOTICE, RECEIPT |
| **Adoption** | `QrTokenType` | FEE_PAYMENT, PARENT_ACCESS, ADMISSION, ATTENDANCE, LOGIN |
| **Governance** | `ControlMode` | CENTRALIZED, CAMPUS_AUTONOMOUS |
| **Pricing** | `PlanType` | FREE, BASIC, PRO, ENTERPRISE |
| **Media** | `MediaType` | LOGO, FAVICON, DOCUMENT |
| | `MediaVariant` | ORIGINAL, SM, MD, LG, DARK, PRINT |

### Models (55+)

#### Identity & Auth

| Model | Purpose |
|-------|---------|
| **User** | Global user. Fields: email, password, phone, isPhoneVerified, platformRole. |
| **VerificationCode** | OTP verification with SHA-256 hash, attempts, lockout. |
| **PasswordResetToken** | One-time password reset tokens. |
| **OtpSession** | Passwordless phone-first auth sessions. Fields: phone, codeHash, expiresAt, consumed, ipAddress, userAgent. |

#### Organization & Structure

| Model | Purpose |
|-------|---------|
| **OrganizationSequence** | Race-safe ORG-XXXXX ID generation. |
| **Organization** | Tenant root. Flat table: identity, legal, address, contact, branding, financeRoutingMode. |
| **OrganizationContact** | Additional contacts per org. |
| **OrganizationAddress** | Multiple addresses per org (HQ, billing, campus). |
| **OrganizationBank** | Bank accounts for fee collection. |

#### Geographic Hierarchy

| Model | Purpose |
|-------|---------|
| **Region** | Top-level (e.g., Punjab). unitCode: `R01`. |
| **SubRegion** | Optional under Region. unitCode: `S01`. |
| **City** | Required for Campus. unitCode: `LHR`. |
| **Zone** | Optional within City. unitCode: `Z01`. |
| **Campus** | Operational unit. fullUnitPath: `R01-S02-LHR-Z01-C03`. |
| **UnitCodeSequence** | Atomic counter per scope. |
| **UnitProfile** | Extended campus profile (logo, address, banking identity). |
| **UnitBankAccount** | Bank accounts per unit with primary enforcement. |

#### RBAC

| Model | Purpose |
|-------|---------|
| **Membership** | User→Org→Campus bridge. Unique [userId, organizationId]. unitPath for hierarchical scoping. |
| **Invitation** | Token-based pending invitations. |

#### Students

| Model | Purpose |
|-------|---------|
| **Student** | Core student record. admissionNo (unique), grade, feeStatus. |
| **StudentEnrollment** | Year-aware enrollment. Unique [studentId, academicYearId]. Links to class, section, campus. promotedFromId for history chain. |

#### Finance

| Model | Purpose |
|-------|---------|
| **FeeHead** | Fee category definitions (Tuition, Transport, etc.). |
| **FeeStructure** | Pricing rules per campus/head/grade. frequency, startMonth, endMonth. |
| **FeeChallan** | Fee bill. totalAmount, paidAmount, status, bankAccountId, month, year, feeStructureId. |
| **PaymentRecord** | Raw incoming payments. gateway, gatewayRef, gatewayPayload. Unique [gateway, gatewayRef]. |
| **LedgerEntry** | Accounting truth. direction (DEBIT/CREDIT), entryType, campusId, entryDate. |
| **StudentFinancialSummary** | Materialized O(1) balance lookup. totalDebit, totalCredit, balance. |
| **PostingRun** | Idempotent fee posting. Unique [organizationId, month, year]. |

#### Academic

| Model | Purpose |
|-------|---------|
| **AcademicYear** | Organization-scoped. status lifecycle (DRAFT→ACTIVE→CLOSED→ARCHIVED). Only one active per org. |
| **Class** | Year-aware grade level. Unique [academicYearId, campusId, name]. |
| **Section** | Operational classroom. capacity, classTeacherId. Unique [classId, name]. |
| **Attendance** | Per student per day per section. Unique [enrollmentId, date]. |
| **Subject** | Year-aware per class. Unique [academicYearId, classId, name]. |
| **Exam** | Exam instance. examType, status lifecycle (DRAFT→ACTIVE→LOCKED→PUBLISHED). |
| **ExamSubject** | Subject marks config for an exam. totalMarks, passingMarks. |
| **StudentExamResult** | Marks per student per subject per exam. Unique [examId, subjectId, studentEnrollmentId]. |
| **GradeScale** | Grade→percentage mapping per org. |
| **PromotionRun** | Idempotent promotion. Unique [organizationId, fromAcademicYearId]. |

#### Reminders & Messaging

| Model | Purpose |
|-------|---------|
| **ReminderRule** | Configurable reminder triggers. triggerType, daysOffset, channel, templateKey, frequencyDays. |
| **ReminderLog** | Prevents duplicates. Tracks deliveredAt, readAt, paymentLink. |
| **MessageTemplate** | DB-stored message templates. Unique [organizationId, channel, templateKey]. |

#### Adoption

| Model | Purpose |
|-------|---------|
| **QrToken** | Secure token pointer for QR codes. type, referenceId, expiresAt, oneTimeUse, metadata. |
| **OnboardingProgress** | Wizard step tracking. currentStep, completed. |
| **DashboardAction** | Role-based action buttons. Unique [organizationId, role, actionKey]. |

#### Payments

| Model | Purpose |
|-------|---------|
| **OrganizationPaymentConfig** | Per-org gateway settings. primaryGateway, enabledJson, configJson. |

#### Governance

| Model | Purpose |
|-------|---------|
| **OrganizationControlPolicy** | CENTRALIZED vs CAMPUS_AUTONOMOUS per domain (fee, academic, messaging, posting). |
| **FeeTemplate** | Head office-defined fee templates. Unique [organizationId, name]. |
| **CampusHealthScore** | Materialized composite score. collectionRate, attendanceRate, academicScore, enrollmentGrowth, riskLevel. |
| **CampusOperationalStatus** | Campus lock mechanism. isFinancialLocked, isAcademicLocked, lockReason. |

#### Pricing & Feature Gating

| Model | Purpose |
|-------|---------|
| **OrganizationPlan** | Plan assignment per org. planType, maxStudents, maxCampuses, expiresAt. |
| **PlanFeature** | Feature matrix. Unique [planType, featureKey]. 11 features × 4 plans. |

#### System

| Model | Purpose |
|-------|---------|
| **Job** | Background job audit trail. idempotencyKey, priority, queue, status, attempts, result. |
| **DomainEventLog** | Persisted event store. eventType, payload (Json), processed. |
| **MediaAsset** | Versioned media audit table. |

---

## 5. Authentication & Authorization

### Auth Stack

- **NextAuth.js v5 (beta)** with Credentials provider and JWT strategy
- **bcryptjs** for password hashing
- **Passwordless phone auth** via OTP (SHA-256 hashed, rate-limited)

### Auth Flows

1. **Email signup** → verify email → login → JWT session
2. **Invite signup** → create user + membership, email auto-verified
3. **Phone-first (passwordless)** → send OTP → verify → create/find user → JWT
4. **Password reset** → forgot-password → token email → reset

### Authorization Guards (`web/lib/auth-guard.ts`)

| Function | Behavior |
|----------|----------|
| `requireAuth()` | Session required. Must have `organizationId` OR `platformRole`. Returns `AuthUser` or 401/403. |
| `requireVerifiedAuth()` | Session only — no org requirement. Used for onboarding. |
| `requireRole(guard, ...roles)` | 403 if user's role not in allowed list. |
| `isSuperAdmin(guard)` | True when `platformRole === "SUPER_ADMIN"`. |

### Role Hierarchy

| Role | Scope | Access Level |
|------|-------|------|
| `SUPER_ADMIN` | Global | All orgs, all data, all operations |
| `SUPPORT` | Global | Read access (platform-level) |
| `ORG_ADMIN` | Organization | Full access within their org |
| `REGION_ADMIN` | Region | Hierarchical scope via unitPath prefix |
| `CAMPUS_ADMIN` | Campus | Full access within assigned campus |
| `ACCOUNTANT` | Campus | Finance operations |
| `TEACHER` | Campus | Student-related, attendance, exams |
| `PARENT` | Campus | Read-only (own children) |
| `STAFF` | Campus | Limited operations |

### Scope Filtering (`web/lib/tenant.ts`)

`scopeFilter(guard, opts)` builds Prisma `where` clauses using `fullUnitPath` prefix matching for hierarchical roles. Prevents cross-tenant and cross-scope data access.

---

## 6. Multi-Tenant Architecture

- **organizationId** on every data model — enforced at query level
- **scopeFilter** for hierarchical RBAC (unitPath prefix matching)
- **resolveOrgId** for writes (SUPER_ADMIN may override)
- **validateCrossRefs** ensures referenced entities belong to same org
- **assertOwnership** verifies record belongs to user's org
- **Feature gating** via `assertFeatureEnabled()` — backend-enforced plan checks
- **Governance policies** — centralized vs autonomous control per domain

---

## 7. Onboarding Flow

Multi-step registration: Identity → Legal → Contact/Address → Branding → Preview → Confirmation.

Client-side state via `OnboardingProvider` (React Context + localStorage). Single DB write at completion. OTP verification for email/mobile/WhatsApp during flow.

Steps also available for **guided school setup wizard** (adoption layer) which auto-bootstraps AcademicYear, Classes, Sections, and FeeStructures from presets.

---

## 8. API Routes Reference

### Auth (6 routes)

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| GET,POST | `/api/auth/[...nextauth]` | NextAuth | NextAuth catch-all |
| POST | `/api/auth/signup` | None | Create account |
| GET | `/api/auth/verify-email` | None | Verify email token |
| POST | `/api/auth/forgot-password` | None | Request password reset |
| POST | `/api/auth/reset-password` | None | Reset password with token |
| POST | `/api/auth/change-password` | `requireAuth` | Change own password |

### Onboarding (8 routes)

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| GET | `/api/onboarding/status` | `requireVerifiedAuth` | Onboarding state + next URL |
| POST | `/api/onboarding/identity` | `requireVerifiedAuth` | Step 1: identity |
| POST | `/api/onboarding/legal` | `requireVerifiedAuth` | Step 2: legal |
| POST | `/api/onboarding/contact-address` | `requireVerifiedAuth` | Step 3: address + contacts |
| POST | `/api/onboarding/branding` | `requireVerifiedAuth` | Step 4: branding |
| POST | `/api/onboarding/verify/send` | `requireVerifiedAuth` | Send OTP |
| POST | `/api/onboarding/verify/confirm` | `requireVerifiedAuth` | Verify OTP |
| GET | `/api/onboarding/certificate` | `requireAuth` | Registration certificate PDF |

### Core Resources

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| GET,POST | `/api/organizations` | `requireAuth` / SUPER_ADMIN | List/create orgs |
| CRUD | `/api/organizations/[id]/contacts` | `requireAuth` | Org contacts |
| CRUD | `/api/organizations/[id]/addresses` | `requireAuth` | Org addresses |
| GET,POST | `/api/regions` | `requireAuth` | Geo hierarchy CRUD |
| GET,POST | `/api/campuses` | `requireAuth` | Campus CRUD |
| GET,POST | `/api/students` | `requireAuth` | Student admission |
| GET,POST,PUT | `/api/invites` | ORG_ADMIN+ | Invite system |
| GET,POST | `/api/memberships` | `requireAuth` | Membership management |
| GET,POST | `/api/unit-profiles` | `requireAuth` | Unit profile CRUD |

### Finance (3 routes)

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| GET,POST | `/api/finance/heads` | `requireAuth` | Fee heads |
| GET,POST | `/api/finance/structures` | `requireAuth` | Fee structures |
| GET,POST,PUT | `/api/finance/challans` | `requireAuth` | Challans |

### Payments (3 routes)

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| POST | `/api/payments/initiate` | `requireAuth` | Initiate gateway payment session |
| POST | `/api/payments/webhook/[gateway]` | Public | Gateway callback (async via queue) |
| GET,POST | `/api/payments/config` | ORG_ADMIN | Payment gateway configuration |

### Reminders (1 route)

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| GET,POST | `/api/reminders/templates` | ORG_ADMIN | Message template CRUD |

### Governance (5 routes)

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| GET,POST | `/api/governance/policy` | ORG_ADMIN | Control mode management |
| GET | `/api/governance/dashboard` | ORG_ADMIN | Chain KPIs, campus comparison, leakage alerts |
| GET,POST | `/api/governance/campus-lock` | ORG_ADMIN | Campus lock/unlock |
| GET,POST | `/api/governance/health-scores` | ORG_ADMIN | Health scores (read + refresh) |
| GET,POST,DELETE | `/api/governance/fee-templates` | ORG_ADMIN | Centralized fee templates |

### Dashboard & QR

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| GET | `/api/dashboard` | `requireAuth` | Role-based action registry |
| GET,POST | `/api/qr` | Varies | QR token generation + resolution |

### Webhooks

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| POST,GET | `/api/webhooks/whatsapp` | Public | WhatsApp delivery status + verification |

### Health & System

| Method | Path | Auth | Summary |
|--------|------|------|---------|
| GET | `/api/health` | None | System health (db, redis). `?check=db` or `?check=redis`. |
| GET | `/api/jobs` | ORG_ADMIN+ | Job monitor |
| POST | `/api/jobs/challan-pdf` | ACCOUNTANT+ | Enqueue challan PDF |
| POST | `/api/jobs/report` | ACCOUNTANT+ | Enqueue report |
| POST | `/api/jobs/bulk-sms` | ORG_ADMIN+ | Enqueue bulk SMS |
| POST | `/api/jobs/import` | CAMPUS_ADMIN+ | Enqueue CSV import |
| GET | `/api/cron/reminders` | ORG_ADMIN+ | Trigger reminder engine |
| GET,DELETE | `/api/dev-tools` | SUPER_ADMIN | Dev utilities |

---

## 9. Background Job System

### Architecture

```
Client → API Route → enqueue() → [Postgres Job row] + [BullMQ queue]
                                        ↓
                          Worker picks up job from Redis
                                        ↓
                          Worker processes + updates Job status
```

**Dual-write pattern:** Every job is persisted to Postgres (audit trail) then enqueued to BullMQ. Idempotency via `idempotencyKey` on the Job model.

### Queues (15)

| Queue | Name | Concurrency | Purpose |
|-------|------|-------------|---------|
| `EMAIL_QUEUE` | email | 5 | Email delivery |
| `OTP_QUEUE` | otp | 5 | OTP code delivery |
| `SMS_QUEUE` | sms | 3 | SMS via Veevo Tech |
| `WHATSAPP_QUEUE` | whatsapp | 1 | WhatsApp messaging (rate limited) |
| `NOTIFICATION_QUEUE` | notification | 3 | Fan-out → email + SMS + WhatsApp |
| `CHALLAN_PDF_QUEUE` | challan-pdf | 2 | PDF generation |
| `REPORT_QUEUE` | report | 2 | Report PDF generation |
| `BULK_SMS_QUEUE` | bulk-sms | 1 | Fan-out → individual SMS jobs |
| `IMPORT_QUEUE` | import | 1 | CSV data import |
| `FINANCE_QUEUE` | finance | 2 | Fee posting, reconciliation |
| `PROMOTION_QUEUE` | promotion | 1 | Academic year rollover |
| `REMINDER_QUEUE` | reminder | 5 | Automated collection reminders |
| `SYSTEM_QUEUE` | system | 2 | Recovery, cleanup, health score refresh |
| `WEBHOOK_QUEUE` | webhook | 10 | Payment gateway webhook processing |
| `EVENT_HANDLER_QUEUE` | event-handlers | 5 | Async domain event handlers |

### Worker Bootstrap

- **Development:** `instrumentation.ts` starts workers in-process
- **Production:** `npm run worker` → `scripts/start-workers.ts` (separate process)

### Recovery System (`queue/recovery.ts`)

Handles stuck jobs (PROCESSING for too long) and dead jobs (exceeded max attempts). Can be triggered via SYSTEM_QUEUE.

---

## 10. Event-Driven Architecture

### Architecture

```
Domain Action → emit(eventType, payload) → EventBus
    ↓ sync handlers (immediate, in-process)
    ↓ async handlers (pushed to EVENT_HANDLER_QUEUE)
    ↓ DomainEventLog (persisted for audit/replay)
```

### Core Components (`lib/events/`)

| File | Purpose |
|------|---------|
| `bus.ts` | Event dispatcher with sync/async handler routing |
| `types.ts` | 30+ typed event interfaces with `EventPayloadMap` |
| `registry.ts` | Handler registration (finance, academic, notification, analytics) |
| `index.ts` | Barrel export |

### Event Categories

| Category | Events |
|----------|--------|
| **Finance** | PaymentReceived, PaymentReconciled, PaymentReversed, ChallanCreated, FeePostingCompleted, FeePostingFailed, PaymentInitiated, WebhookProcessed |
| **Academic** | StudentEnrolled, StudentPromoted, StudentWithdrawn, StudentTransferred, AcademicYearClosed, AcademicYearActivated, ExamPublished, PromotionRunCompleted |
| **Notification** | ReminderRunCompleted, ReminderSent |
| **Adoption** | OtpRequested, PhoneLoginCompleted, QrTokenGenerated, QrTokenResolved, ParentAccessCreated, WizardStepCompleted, OrganizationBootstrapped |
| **Governance** | CampusLocked, CampusUnlocked, ControlPolicyChanged, CampusHealthRefreshed |
| **System** | JobFailed, ReportGenerated |

### DomainEventLog Model

Every emitted event is persisted with `organizationId`, `eventType`, `payload` (Json), and `processed` flag. Supports replay, debugging, analytics pipelines, and future microservice migration.

---

## 11. Financial Engine

### Services (`lib/finance/`)

| Service | Purpose |
|---------|---------|
| `challan-routing.service.ts` | Deterministic bank selection: Campus → UnitProfile → Primary BankAccount. Supports `NEAREST_PARENT_PRIMARY` mode (hierarchy traversal). O(1) via in-memory mapping. |
| `reconciliation.service.ts` | Matches payments to challans. Creates LedgerEntry (CREDIT). Updates StudentFinancialSummary atomically. Handles partial payments, overpayments, refunds. All in `$transaction`. |
| `student-ledger.service.ts` | Balance = SUM(DEBIT) - SUM(CREDIT). Live computation + materialized summary. Aging buckets (0-30, 31-60, 61-90, 90+). Defaulter detection. |
| `fee-posting.service.ts` | Automated monthly/term challan generation. Idempotent via PostingRun + FeeChallan unique constraints. Batch-safe (500 per chunk via createMany). |
| `defaulter.service.ts` | Student-level aging, campus/region aggregation, collection efficiency, risk indicators. |
| `reminder-engine.service.ts` | Detects overdue students via aging. Matches ReminderRules by trigger type + daysOffset. Frequency-based dedup. Payment link injection via QR tokens. Delivery status tracking (WhatsApp webhooks). |

### Key Design Decisions

- **Ledger is immutable** — never modify old entries, only add compensating entries
- **Balance uses direction** — DEBIT (student owes) vs CREDIT (student paid), not negative amounts
- **StudentFinancialSummary** updated atomically inside reconciliation `$transaction`
- **PostingRun** unique constraint prevents duplicate fee generation
- **Arrears carry forward** naturally via ledger (no manual copy)

---

## 12. Academic Engine

### Services (`lib/academic/`)

| Service | Purpose |
|---------|---------|
| `academic-year.service.ts` | CRUD + activation (atomic: deactivate all → activate one). Guards: only one active year per org. |
| `class-section.service.ts` | Year-aware class/section CRUD. Classes reset each year. Section capacity enforcement. |
| `enrollment.service.ts` | Enroll student into active year. Unique [studentId, academicYearId]. Section capacity check. Transfer support (section/class/campus). |
| `attendance.service.ts` | Bulk marking per section per day. Validates enrollment, no duplicates, no withdrawn students. Normalizes dates to UTC. |
| `exam.service.ts` | Exam lifecycle (DRAFT→ACTIVE→LOCKED→PUBLISHED). Bulk result entry. Tabulation (groupBy obtainedMarks). Grade computation via GradeScale. |
| `promotion.service.ts` | Year rollover: clone classes/sections → promote/retain students → link via promotedFromId → close old year → activate new year. Idempotent via PromotionRun. ORG_ADMIN only. |

### Key Design Decisions

- **Everything is year-scoped** — academicYearId on Class, Section, Enrollment, Attendance, Exam, Subject
- **Enrollment is the bridge** — not Student directly. Finance, attendance, exams query via enrollment.
- **Promotion creates new records** — old enrollment → COMPLETED, new enrollment → ACTIVE with promotedFromId
- **Class structure cloned** on rollover — Grade 1 (2025) ≠ Grade 1 (2026)

---

## 13. Adoption Layer

Non-breaking, additive layer for market accessibility. All features call existing core services.

### Passwordless Phone Auth (`lib/adoption/otp.service.ts`)

- OTP sent via SMS queue, SHA-256 hashed in DB
- Per-phone + per-IP rate limiting (5 requests per 5 min)
- IP address + User Agent tracking
- Finds/creates User by phone, links to Membership
- Returns JWT session on success

### QR Token Infrastructure (`lib/adoption/qr-token.service.ts`)

- Secure token pointer: `https://app.sairex.com/q/{tokenId}`
- Types: FEE_PAYMENT, PARENT_ACCESS, ADMISSION, ATTENDANCE, LOGIN
- Time-bound, optional one-time use
- Tenant-isolated resolution
- Metadata support (Json field)

### Guided Setup Wizard (`lib/adoption/bootstrap.service.ts`)

- `bootstrapOrganizationSetup()` — transactional, idempotent
- Auto-creates: AcademicYear, Classes (from presets), Sections, FeeStructures
- Supports presets: Nursery→10, 1→5, 6→10, 1→12, Custom
- OnboardingProgress model tracks wizard state

### Action Dashboard (`lib/adoption/dashboard.service.ts`)

- Role-based action grid (6 buttons, not 60 menus)
- Quick stats from optimized queries
- Activity feed from DomainEventLog
- DashboardAction model for per-org customization

---

## 14. Payment Gateway Integration

### Architecture

```
Parent scans QR → Payment Gateway → Webhook → WEBHOOK_QUEUE → reconciliation → ledger + events
```

### Gateway Abstraction (`lib/payments/gateway.interface.ts`)

```typescript
interface PaymentGatewayAdapter {
  gateway: PaymentGateway;
  createPaymentSession(input): Promise<PaymentSessionResult>;
  verifyWebhook(payload, signature, headers): boolean;
  normalizeWebhook(payload): NormalizedPayment;
}
```

### Adapters (`lib/payments/adapters/`)

| Adapter | Gateway | Status |
|---------|---------|--------|
| `manual.adapter.ts` | MANUAL | Complete |
| `easypaisa.adapter.ts` | EASYPAISA | Skeleton (needs API credentials) |
| `jazzcash.adapter.ts` | JAZZCASH | Skeleton |
| `onebill.adapter.ts` | ONEBILL | Skeleton |
| `stripe.adapter.ts` | STRIPE | Skeleton |

### Payment Service (`lib/payments/payment.service.ts`)

- `initiatePayment()` — resolves adapter, creates session, stores PENDING PaymentRecord
- `processWebhook()` — verifies signature, normalizes payload, prevents duplicates via `[gateway, gatewayRef]`, delegates to reconciliation
- `getPaymentConfig()` / `savePaymentConfig()` — per-org gateway configuration

---

## 15. Chain Governance (Master Control Panel)

For school chains with 20+ campuses. 100% additive — no impact on single-school mode.

### Control Policy (`lib/governance/control-policy.service.ts`)

- **ControlMode per domain:** fee, academic, messaging, posting
- **CENTRALIZED** = only ORG_ADMIN can modify; **CAMPUS_AUTONOMOUS** = campus-level users can modify
- `enforceOperationalGuard()` — composite check: policy + campus lock in one call
- **Campus locks** — isFinancialLocked / isAcademicLocked with reason tracking

### Campus Health Score (`lib/governance/campus-health.service.ts`)

Composite score (0-100) computed from:
- Collection Rate (40%) — paidAmount/totalAmount via groupBy
- Attendance Rate (30%) — 30-day present+late/total
- Academic Score (20%) — exam pass rate
- Enrollment Growth (10%) — year-over-year change

Materialized to `CampusHealthScore` table. Risk levels: LOW (75+), MODERATE (50-74), HIGH (30-49), CRITICAL (<30).

### Master Dashboard (`lib/governance/master-dashboard.service.ts`)

- **Chain KPIs** — total campuses, students, collection, outstanding, efficiency %, attendance, digital payment ratio
- **Campus Comparison** — per-campus table with all metrics + lock status
- **Leakage Detection** — flags low collection (<30% HIGH, <50% MEDIUM) + unreconciled payment backlogs

### Fee Templates

Head Office-defined fee templates that can be pushed to campuses when fee control is centralized.

---

## 16. Launch Readiness

### Feature Gating (`lib/feature-gate.ts`)

- **Internal PlanType:** FREE, BASIC, PRO, ENTERPRISE
- **Public commercial tiers:** STARTER, PROFESSIONAL, ENTERPRISE
- **Naming contract:** internal plans stay technical for entitlement storage; UI/commercial surfaces expose public tiers from `lib/billing/pricing-architecture.ts`
- **11 feature keys:** DIGITAL_PAYMENTS, WHATSAPP_REMINDERS, SMS_REMINDERS, MULTI_CAMPUS, PROMOTION_ENGINE, ADVANCED_REPORTS, QR_TOKENS, BULK_IMPORT, API_ACCESS, CUSTOM_BRANDING, EVENT_WEBHOOKS
- **In-memory cache** with 5-minute TTL
- `assertFeatureEnabled(orgId, feature)` — returns 403 NextResponse or null
- `seedPlanFeatures()` — populates matrix from defaults

| Feature | Free | Basic | Pro | Enterprise |
|---------|------|-------|-----|------------|
| Digital Payments | - | Y | Y | Y |
| WhatsApp Reminders | - | - | Y | Y |
| Multi-Campus | - | - | Y | Y |
| Advanced Reports | - | - | - | Y |
| API Access | - | - | - | Y |

### Pricing Architecture (`lib/billing/pricing-architecture.ts`)

- **Commercial model:** per-student, per-month billing in PKR (`PER_STUDENT_MONTH`)
- **Tiering basis:** student count (not per-feature upsell messaging)
- **STARTER:** 100-400 students, PKR 40-60 per student/month
- **PROFESSIONAL:** 401-1500 students, PKR 70-90 per student/month
- **ENTERPRISE:** 1501+ students, custom commercial model
- **Trial policy:** 30 days, full feature, no credit card required
- **Upgrade guidance:** SIMPLE -> PRO recommendation is generated from live student usage (`lib/billing/plan-usage.service.ts`)
- **Annual prepay support:** usage payload includes annual prepay discount metadata

### Encryption (`lib/encryption.ts`)

AES-256-GCM for sensitive config: payment gateway API keys, WhatsApp tokens, SMS credentials. Key from `ENCRYPTION_KEY` env (64-char hex).

### Rate Limiting (`lib/rate-limit.ts`)

Sliding-window in-memory counters:
- `API_GENERAL`: 100/min
- `OTP_REQUEST`: 5/5min
- `LOGIN_ATTEMPT`: 10/5min
- `WEBHOOK`: 200/min
- `QR_RESOLVE`: 60/min
- `PAYMENT_INITIATE`: 20/min

`applyRateLimit(request, prefix, config)` — returns 429 or null. Tenant-scoped variant available.

### Security (`lib/security.ts`)

- `assertOwnership()` — hard tenant guard
- `isWebhookReplay()` — 10-minute dedup window
- `isWebhookTimestampValid()` — rejects stale webhooks (>5min)
- `SECURITY_HEADERS` — HSTS, X-Frame-Options, etc.

### Health Checks (`/api/health`)

- `GET /api/health` — overall status (checks DB + Redis)
- `GET /api/health?check=db` — database only
- `GET /api/health?check=redis` — Redis only
- Returns 200 (ok/degraded) or 503 (down) with latency metrics

---

## 17. PDF Generation

### Challan PDF (`lib/pdf/challan-pdf.ts`)

PDFKit landscape. Three copies per page: Bank, School, Student. Includes org info, campus, bank details, student details, fee breakdown, PAID stamp.

### Report PDF (`lib/pdf/report-pdf.ts`)

PDFKit A4 portrait. Configurable columns + rows with pagination. Types: FEE_COLLECTION, FEE_DEFAULTERS, STUDENT_LIST.

---

## 18. UI Component System

### Sx Components (`components/sx/`)

| Component | Purpose |
|-----------|---------|
| `SxPageHeader` | Page title bar with actions |
| `SxButton` | Themed button with loading state |
| `SxDataTable<T>` | Generic data table with columns, skeleton |
| `SxStatusBadge` | Status display with auto-mapped variants |
| `SxFormSection` | Form field grouping (1/2/3 column grid) |
| `SxAmount` | Formatted currency display |
| `SxProfileHeader` | Avatar + name + meta display |

### Shadcn UI

Avatar, Badge, Button, Card, Checkbox, Dialog, DropdownMenu, Form, Input, Label, ScrollArea, Select, Separator, Sheet, Skeleton, Sonner, Switch, Table, Tabs, Textarea, Tooltip.

---

## 19. Validation Layer

All validations use **Zod v4** with **zodResolver** for react-hook-form.

### Schema Files (`lib/validations/`)

| File | Schemas |
|------|---------|
| `organization.ts` | createOrganizationSchema, updateOrganizationSchema |
| `organization-address.ts` | address CRUD schemas |
| `organization-contact.ts` | contact CRUD schemas |
| `onboarding.ts` | identitySchema, legalSchema, contactAddressSchema, brandingSchema |
| `signup.ts` | signupSchema |

---

## 20. Admin Pages

| Page | Route | Features |
|------|-------|----------|
| Dashboard | `/admin/dashboard` | Stats cards, revenue chart |
| Organizations | `/admin/organizations` | CRUD table, create dialog |
| Geo Hierarchy | `/admin/regions` | Tabs: Regions, SubRegions, Cities, Zones |
| Campuses | `/admin/campuses` | List + create dialog |
| Students | `/admin/students` | List + admit dialog |
| Users & Invites | `/admin/users` | Users/invites tables, lock/unlock |
| Finance | `/admin/finance` | Fee heads, structures, challans |
| Print Challan | `/admin/finance/challans/[id]/print` | 3-copy challan layout |
| Audit Log | `/admin/audit` | Audit trail viewer |
| Job Monitor | `/admin/jobs` | Stats, filters, paginated table |
| Dev Tools | `/admin/dev-tools` | SUPER_ADMIN utilities |
| Change Password | `/admin/change-password` | Password change form |

---

## 21. Navigation & Sidebar

```
├── Dashboard
├── Core Setup (Organizations, Geo Hierarchy, Campuses)
├── Management (Students, Fee Module)
├── Admin (Users & Invites)
├── System (Job Monitor, Audit Log)
└── Development (Dev Tools)
```

---

## 22. External Services

| Service | Technology | Purpose |
|---------|-----------|---------|
| Email | Nodemailer → Titan SMTP (smtp.titan.email:465) | Transactional email |
| SMS | Axios → Veevo Tech API | SMS delivery |
| WhatsApp | whatsapp-web.js (dev) / WhatsApp Cloud API (prod) | Messaging with delivery tracking |
| PDF | @react-pdf/renderer + PDFKit | Certificates + challans + reports |
| Storage | AWS S3 + sharp | Media assets (logo variants) |
| Payments | EasyPaisa, JazzCash, 1Bill, Stripe | Fee payment processing |

---

## 23. Environment Variables

### Required (`web/.env.local`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `NEXTAUTH_URL` | NextAuth base URL |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME` | Email delivery |

### Optional

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Redis connection (default: `redis://127.0.0.1:6379`) |
| `ENCRYPTION_KEY` | AES-256-GCM key (64-char hex) for sensitive config encryption |
| `VEEVO_HASH`, `VEEVO_SENDER` | SMS provider credentials |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` | S3 media storage |
| `NEXT_PUBLIC_CDN_URL` | CDN for uploaded assets |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook verification token |

---

## 24. Scripts & Tooling

### npm Scripts

| Script | Purpose |
|--------|---------|
| `postinstall` | Auto-generate Prisma client |
| `dev` | Development server (Turbopack) |
| `build` | Production build with Prisma generate |
| `start` | Production server |
| `lint` | ESLint check |
| `worker` | Standalone worker process (all 15 queues) |

### Utility Scripts

| Script | Purpose |
|--------|---------|
| `seed-admin.ts` | Create root org, SUPER_ADMIN user, sequence |
| `seed-plan-features.ts` | Populate PlanFeature matrix (4 plans × 11 features) |
| `start-workers.ts` | Production worker runner |
| `test-api-security.ts` | API security testing |

---

## 25. Enterprise Media Asset System

AWS S3 with server-side image processing (sharp). Uploads validated, optimized to WEBP, stored as versioned variants (SM 64px, MD 128px, LG 256px, ORIGINAL). Rollback supported via MediaAsset audit table.

Key endpoint: `POST /api/media/logo/upload` (FormData → validate → optimize → S3 → save).

---

## 26. Registration Certificate PDF System

Server-generated 2-page landscape PDF via `@react-pdf/renderer`. Page 1: formal certificate with gold borders. Page 2: organization profile. Rendered from database, streamed inline.

Endpoint: `GET /api/onboarding/certificate?orgId=ORG-00002`.

---

## 27. Known Issues & Technical Debt

### Bugs

1. **SxAmount prop mismatch**: `finance/page.tsx` passes `value={...}` but `SxAmount` expects `amount={...}`
2. **GET /api/jobs/[id]** has no org ownership check

### Non-compliance with Coding Standards

| Page | Issues |
|------|--------|
| `regions/page.tsx` | Inline `rules={{}}` instead of zodResolver (B8) |
| `campuses/page.tsx` | Inline `rules={{}}` (B8) |
| `students/page.tsx` | Inline `rules={{}}` (B8) |
| `change-password/page.tsx` | Inline `rules={{}}` (B8) |
| `jobs/page.tsx` | Raw `<select>` (B4) |
| `dashboard/page.tsx` | Hardcoded color classes (B7) |

### Architecture Notes

- **Payment gateway adapters** are skeleton implementations — need real API credentials and endpoint URLs
- **WhatsApp client** (whatsapp-web.js) for dev only — production requires WhatsApp Cloud API
- **PDF storage** to `public/generated/` — needs S3 for production
- **Campus health scores** need a scheduled job (daily cron) to auto-refresh
- **Worker resilience** — if Redis is down, jobs saved in Postgres but not processed until Redis returns

---

## 28. Coding Standards (Enforced Rules)

Two rule files in `.cursor/rules/`:

### Component Standards (`sairex-component-standards.mdc`)

**Banned in `web/app/admin/**`:**
- No raw HTML: `<table>`, `<button>`, `<input>`, `<select>` → use Sx/shadcn
- No `alert()`/`confirm()` → use `toast` from sonner
- No raw `fetch()` → use `api` from `@/lib/api-client`
- No hardcoded Tailwind color classes → design tokens only
- No `any` type annotations
- No inline `rules={{}}` → use `zodResolver` + Zod schema

### API Patterns (`sairex-api-patterns.mdc`)

1. Use `api.get<T>()` / `api.post<T>()` (never raw `fetch()`)
2. Include type parameter
3. Handle discriminated union: `if (result.ok) { ... } else if (result.fieldErrors) { ... } else { ... }`
4. Map field errors to form via `form.setError()`
5. Show toast on success/error

---

## 29. Mobile Action Dashboard - Master Build Plan

Execution model for a production-grade mobile control center. Delivery is phase-locked: complete each phase, verify checklist, then proceed.

### Phases

| Phase | Output | Status |
|------|--------|--------|
| 1 | UX Architecture (action-based mobile structure) | Locked |
| 2 | Data Contract (single source of truth API + types) | Locked |
| 3 | State Layer (React Query + mobile context + offline foundation) | Locked |
| 4 | UI Foundation (layout shell + bottom action bar) | Pending |
| 5 | Core Action Cards (students/fees/attendance/exams) | Pending |
| 6 | Smart Widgets (alerts/today/quick stats) | Pending |
| 7 | Performance & Offline (cache polish + skeletons + PWA) | Pending |

### Locked principles

- Mobile is action-first, not a mini desktop dashboard.
- Frontend does not hardcode role actions; backend returns payload-driven actions.
- Context is tenant-safe and derived from authenticated user scope.
- Payload model supports role, plan, feature flags, and multi-campus expansion.
- UI prioritizes thumb-zone ergonomics and fast first paint.

### Phase 1 (UX Architecture) checklist

- Action-based layout, not menu tree
- Role-driven payload model
- Dynamic cards
- Thumb-friendly action grid
- Context bar (org/campus/role/sync)
- Bottom action bar

### Phase 2 (Data Contract) checklist

- `GET /api/mobile/dashboard` as primary endpoint
- Enum-based mobile route contract
- Role-driven backend mapping
- Plan enforcement flags in payload
- Pre-aggregated KPI/alert/action sections
- Offline metadata in response

### Phase 2 (Data Contract) - Locked Spec

#### Endpoint

- `GET /api/mobile/dashboard`
- Context is derived from authenticated session token.
- Tenant safety rule: no `orgId` query parameter for normal access.

#### Master payload contract

```ts
export type MobileDashboardPayload = {
  context: {
    orgId: string
    orgName: string
    campusId?: string
    campusName?: string
    role: UserRole
    plan: PlanType
  }
  today: TodayItem[]
  kpis: KPIItem[]
  primaryActions: ActionItem[]
  secondaryActions: ActionItem[]
  alerts: AlertItem[]
  meta: {
    syncTime: string
    pendingOfflineActions: number
  }
}
```

```ts
type TodayItem = {
  id: string
  label: string
  value: string
  tone: "info" | "success" | "warning" | "danger"
  icon: MobileIcon
  action?: MobileRoute
}
```

```ts
type KPIItem = {
  id: string
  label: string
  value: string
  trend?: "up" | "down"
  tone?: "default" | "success" | "danger"
}
```

```ts
type ActionItem = {
  id: string
  label: string
  icon: MobileIcon
  route: MobileRoute
  tone?: "primary" | "success" | "warning"
  badge?: string
  disabled?: boolean
}
```

```ts
type AlertItem = {
  id: string
  title: string
  description?: string
  tone: "info" | "warning" | "danger"
  actionLabel?: string
  actionRoute?: MobileRoute
}
```

#### Mobile route enum

```ts
export enum MobileRoute {
  COLLECT_FEE = "COLLECT_FEE",
  MARK_ATTENDANCE = "MARK_ATTENDANCE",
  ADD_STUDENT = "ADD_STUDENT",
  ISSUE_CHALLAN = "ISSUE_CHALLAN",
  VIEW_DEFAULTERS = "VIEW_DEFAULTERS",
}
```

#### Backend ownership

- Role-to-action mapping lives in backend service logic, not in mobile UI.
- Plan enforcement is attached in payload (`disabled`, `badge: "Upgrade"`).
- Payload is pre-aggregated and Redis-cache-friendly by design.

#### Backend files

```text
/app/api/mobile/dashboard/route.ts
/lib/mobile/mobile-dashboard.service.ts
/lib/mobile/mobile-dashboard.mapper.ts
/lib/mobile/mobile-actions.registry.ts
```

#### Multi-campus extension (future-safe)

- Planned endpoint: `POST /api/mobile/context/switch-campus`
- Context payload remains source of truth for active org/campus.

#### Completion checklist (locked)

- Single endpoint in production
- Role-driven backend mapping complete
- Plan enforcement in payload
- Enum-based route contract
- Pre-aggregated KPI/today/action/alert data
- Offline metadata included (`syncTime`, `pendingOfflineActions`)

### Phase 3 (State Layer) checklist

- Single `useMobileDashboard()` hook
- React Query cache + background refresh
- Persisted query cache foundation
- Mobile context sourced from payload (not local overrides)
- Sync freshness + pending offline action metadata
- Optimistic action execution pattern scaffold

### Phase 3 (State Layer) - Locked Spec

#### Goal

One hook powers the mobile dashboard end-to-end with fetch, cache, background sync, offline readiness, and action helpers.

#### Core hook contract

```ts
useMobileDashboard()
```

- Uses React Query with:
  - `queryKey: ["mobile-dashboard"]`
  - `staleTime: 60 * 1000`
  - `refetchInterval: 60 * 1000`
  - `retry: 1`

#### Fetcher contract

- Fetches from `GET /api/mobile/dashboard`
- Returns `MobileDashboardPayload`
- Throws on non-OK response

#### Offline cache strategy

- Enable persisted query cache with:
  - `persistQueryClient`
  - `createSyncStoragePersister`
  - `window.localStorage`
- Last valid dashboard must render while offline.

#### Sync status rules

Derived from payload:

- `meta.syncTime`
- `meta.pendingOfflineActions`

Computed UI flag:

```ts
isOutdated = now - syncTime > 2 minutes
```

#### Mobile context provider

`MobileContextProvider` is sourced from payload only (tenant-safe), not local storage.

```ts
type MobileContext = {
  orgId: string
  campusId?: string
  role: UserRole
}
```

#### Action execution pattern

All mutations run through `useMobileAction()`:

1. Optimistic UI update
2. Queue offline action when offline
3. Sync queue on reconnect

#### Offline queue foundation

```ts
mobileOfflineQueue: {
  id
  actionType
  payload
  createdAt
}
```

Queue length feeds:

- `meta.pendingOfflineActions`

#### Selector helpers

Hook exposes mapped dashboard sections directly (no fragile UI searching):

- `today`
- `kpis`
- `primaryActions`
- `secondaryActions`
- `alerts`

#### Final hook output shape

```ts
{
  context
  today
  kpis
  primaryActions
  secondaryActions
  alerts
  sync
  isLoading
  isError
  refresh
}
```

#### Phase 3 file structure

```text
/lib/mobile/hooks/use-mobile-dashboard.ts
/lib/mobile/mobile-context.tsx
/lib/mobile/mobile-query-client.ts
/lib/mobile/mobile-offline-queue.ts
```

#### Loading UX rule (mobile-grade)

- Prefer skeleton/shimmer states over spinners:
  - skeleton today card
  - skeleton action grid
  - shimmer KPI strip

#### Completion checklist (locked)

- Single master hook implemented
- Persisted query cache enabled
- Offline queue foundation created
- Sync status logic implemented
- Org/campus/role context sourced from payload only
- Optimistic action pattern scaffolded

### Phase 4 (Mobile UI Foundation) - Locked Spec

#### Goal

Deliver a production-ready mobile shell that all role actions plug into without redesign.

#### Root mobile layout tree

```text
MobileDashboardLayout
 ├─ SafeAreaContainer
 │   ├─ ContextBar
 │   ├─ ScrollArea
 │   │   ├─ TodayFocusCard
 │   │   ├─ PrimaryActionGrid
 │   │   ├─ KPIHorizontalStrip
 │   │   └─ AlertStack
 │   └─ BottomActionBar
```

#### Component blueprint

```text
/components/mobile/
  mobile-container.tsx
  context-bar.tsx
  today-focus-card.tsx
  primary-action-grid.tsx
  kpi-strip.tsx
  alert-stack.tsx
  bottom-action-bar.tsx
```

#### Safe area container contract

- Full-height mobile surface
- Bottom padding reserved for fixed thumb-zone nav bar
- Token-based background (`bg-background`)

#### Context bar contract

Displays:

- org name
- campus name / selector placeholder
- role badge
- sync status (`Live`, `Syncing`, `Offline`)

#### Today Focus card contract

- Renders `today[]` items from payload
- 2-per-row mobile-friendly grid
- no hardcoded copy

#### Primary action grid contract

- Uses `primaryActions[]` from payload
- 2x2 thumb-friendly layout
- large tap target (~88px height)
- action tone maps to semantic tokens

#### KPI strip contract

- Horizontal scroll for compact KPI cards
- Powered by `kpis[]` only
- no UI-level metric derivation

#### Alert stack contract

- Priority tones:
  - danger -> destructive style
  - warning -> warning style
  - info -> neutral/info style
- Supports optional CTA via `actionLabel` + deep link route

#### Bottom action bar contract

- Fixed bar in thumb zone
- baseline tabs:
  - Home
  - Actions
  - Search
  - Notifications
  - Profile

#### Page implementation target

```text
/app/mobile/dashboard/page.tsx
```

Uses:

- `useMobileDashboard()` for all data
- skeleton layout for first paint
- cached render for background refresh

#### Theme constraints

- Use semantic SAIREX tokens only (`bg-primary`, `bg-success`, `bg-warning`, `bg-destructive`, etc.)
- avoid hardcoded Tailwind color scales in component styles

#### Completion checklist (locked)

- Safe-area mobile container built
- Context bar shows org/campus/role/sync
- Today Focus grid rendered
- 2x2 primary action grid rendered
- Horizontal KPI strip rendered
- Alert stack rendered
- Fixed bottom action bar rendered
- Semantic token theming applied

---

## 29. Phase 8 Completion + Phase 9 Revenue Optimization (Step 1)

### Phase 8 Completion Status

The following Phase 8 delivery items are incorporated in code:

- **10-minute onboarding wizard:** public wizard flow and step APIs (`app/(public)/onboarding/*`, `app/api/onboarding/wizard/*`)
- **QR-based parent/staff join:** QR token generation, resolve, and claim (`lib/adoption/qr-invite.service.ts`, `app/join/page.tsx`, `app/api/invite/*`)
- **Zero-training SIMPLE mode:** persisted organization mode with runtime toggle (`lib/system/mode.service.ts`, `app/api/organizations/mode/route.ts`, `app/admin/ModeToggleButton.tsx`)
- **One-click demo school generator:** super-admin endpoint + seeded demo orchestration (`app/api/super-admin/demo/generate/route.ts`, `lib/demo/demo-generator.service.ts`)

### Phase 9 Step 1 Status (Pricing Architecture)

Step 1 success criteria are implemented:

- [x] Pricing tiers defined
- [x] Feature mapping clear
- [x] Student-based billing logic aligned
- [x] Trial strategy defined
- [x] Upgrade path clear (SIMPLE -> PRO)

### Plan Naming Alignment (Canonical Contract)

Use this mapping to avoid naming drift between internal entitlement logic and public pricing communication:

| Internal `PlanType` | Public Tier | Notes |
|---------------------|-------------|-------|
| FREE | STARTER | Default persisted plan with trial overlays |
| BASIC | STARTER | Legacy/internal transitional plan; still maps to STARTER for commercial communication |
| PRO | PROFESSIONAL | Predictive and advanced operations tier |
| ENTERPRISE | ENTERPRISE | Chain and custom-commercial tier |

### Temporary Theme Migration Utility (Remove After Migration)

To accelerate token migration audits, a temporary CSS utility is available in `web/app/globals.css`:

- `.debug-tokens * { outline: 1px solid red; }`

Usage:

- Wrap a page/section with `<div className="debug-tokens">...</div>` to quickly identify unreviewed styles.

Removal policy:

- This utility is **temporary** and must be removed once component token migration is complete.
- Do not keep `debug-tokens` wrappers in production-facing pages after signoff.

### APIs Exposing Revenue Optimization Data

- `GET /api/billing/plan-usage` — plan, usage/limits, PKR student pricing range, trial state, and upgrade recommendation
- `GET/PATCH /api/billing/config` — per-student fee and cycle config controls
- `GET /api/organizations/mode` and `PATCH /api/organizations/mode` — SIMPLE/PRO mode control surface

---

## 30. Production Release & Rollback Runbook

This section defines the minimum operational procedure for safe production deployments.

### Ownership and Release Roles

- **Release Captain (required):** owns final go/no-go and timeline.
- **Backend Owner:** validates migrations, API health, workers, and queue stability.
- **Frontend Owner:** validates critical UX routes and post-deploy smoke.
- **QA Owner:** executes smoke checklist and records outcomes.

No production deploy should start without all three roles assigned.

### Pre-Deploy Checklist (Blocking)

- [ ] `npm run lint` passes in `web/`
- [ ] `npm run build` passes in `web/`
- [ ] `npm test` passes in `web/`
- [ ] CI workflow is green for target commit (`.github/workflows/ci.yml`)
- [ ] Database backup/snapshot taken and timestamp recorded
- [ ] Migration dry-run validated on staging/test data (if schema changed)
- [ ] `REDIS_URL` is present for worker runtime
- [ ] `WORKER_BOOTSTRAP_MODE` is explicitly set (`external` in production recommended)
- [ ] Sentry DSN/org/project env values are present

### Deployment Sequence (Canonical Order)

1. **Freeze window starts** (no new merges to release branch)
2. **Run pre-deploy checks** and capture evidence
3. **Backup database**
4. **Deploy API/app revision**
5. **Run migrations** (`prisma migrate deploy`)
6. **Start/confirm worker process** (`npm run worker` in worker service)
7. **Verify `/api/health` and `/api/health?check=workers`**
8. **Run post-deploy smoke checks**
9. **Release captain signs off**

### Post-Deploy Smoke Test (Mandatory)

- [ ] `GET /api/health` => `ok` or expected `degraded` (with known reason)
- [ ] `GET /api/health?check=workers` => workers check is `ok`
- [ ] Login / OTP request + verify flow works
- [ ] Password reset request + reset flow works
- [ ] Webhook ingress endpoint accepts payload and worker processes it
- [ ] Critical dashboard path loads (`/admin/dashboard` and `/mobile/dashboard`)
- [ ] One write-path check (e.g., invite generation or attendance action) succeeds

### Rollback Triggers (Immediate)

Trigger rollback if any of the following occurs for more than 10 minutes after deploy:

- `health.status = down`
- worker check stays `down` and cannot be recovered quickly
- spike in 5xx errors or auth failures beyond normal baseline
- payment webhook processing failures are sustained
- migration-related runtime errors affect core routes

### Rollback Procedure

1. Announce rollback start in release channel
2. Shift traffic to previous stable app revision
3. Keep workers aligned with rolled-back app version
4. If migration is backward-compatible, retain DB state and verify app recovery
5. If migration is not backward-compatible:
   - restore DB snapshot taken pre-deploy
   - re-apply previous stable migration state
6. Re-run smoke tests on rolled-back version
7. Record incident summary + corrective actions before next release

### Release Evidence Template

Store this in release notes or deployment ticket:

- Release commit SHA:
- Deploy start/end time:
- DB backup timestamp:
- Migration(s) applied:
- Worker mode/config:
- Smoke test results:
- Sentry error delta (before/after):
- Final decision: GO / ROLLBACK

---

## 31. Step 9 Controlled Theme Migration Plan

Objective:

- Eliminate hardcoded colors gradually and standardize on:
  - `bg-surface`
  - `bg-primary`
  - `text-muted`
  - `border-border`

### Migration Waves

| Wave | Scope | Risk | Impact |
|------|-------|------|--------|
| 1 | UI primitives (`components/ui/*`) | Low | System-wide |
| 2 | Layout shells (`app/*/layout.tsx`, sidebars, headers) | Low | Identity |
| 3 | Dashboards (Daily Ops, Finance, Attendance, Admin overview) | Medium | Product feel |
| 4 | Forms & tables | High | Final polish |

### Safety Tooling (Temporary)

- `web/app/globals.css` includes:
  - `.debug-tokens * { outline: 1px solid red; }`
  - `.token-debug [class*="bg-white"] { outline: 2px solid red; }`

Usage:

- Wrap target page/section:
  - `<div className="debug-tokens">...`
  - or `<div className="token-debug">...`

Removal:

- Remove debug wrappers after migration validation.
- Keep helper classes only while migration is active.

### Execution Method

- No bulk mass-replace.
- Folder-by-folder cycle:
  1. Migrate
  2. Run app
  3. Visual verify
  4. Commit

Suggested commit style:

- `theme: migrate ui primitives to surface tokens`
- `theme: migrate admin shell to tokenized surfaces`

### Definition of Done

- No `bg-white` in shared components.
- No `text-gray-*` in shared components.
- Main dashboards use tokenized surfaces.
- Hardcoded blue action backgrounds removed from target screens.

Allowed temporary exceptions:

- charts
- status badges
- legacy screens

### Progress Tracker

- ✅ Wave 1 — UI primitives
- ✅ Wave 2 — Layout shells
- ✅ Wave 3 — Dashboards & ERP
- ✅ Wave 4 — Forms & tables

Wave 1 note:

- Repo scan confirms no `bg-white`, `text-gray-*`, `border-gray-*`, or `bg-blue-*` usage in `web/components/ui/*`.

Wave 2 note:

- Repo scan confirms no `bg-white`, `text-gray-*`, `border-gray-*`, or `bg-gray-*` usage in layout shells (`web/app/**/layout.tsx`, `web/components/layout/*`).
- Root shell enforces `min-h-screen bg-background text-foreground` at `web/app/layout.tsx`.
- Admin shell follows locked sidebar -> background main content layering in `web/app/admin/layout.tsx`.

### Wave 3 Priority and Rules

Migration order:

1. Daily Operations Dashboard
2. Fee Collection screen
3. Attendance screen
4. Admin overview dashboard
5. Mobile Action dashboard container level

Structural standard:

- Page container uses `bg-background` with spacing only.
- Cards use `bg-surface border-border rounded-xl`.
- Primary CTAs use `bg-primary text-white hover:opacity-90`.
- Labels use `text-muted`.
- ERP meaning colors stay system-locked (`--sx-success`, `--sx-warning`, `--sx-danger`, `--sx-info`).

Wave 3 progress note:

- Daily Operations Dashboard migrated to surface/token structure and primary-driven quick actions.
- Collect Fee workspace (`web/app/admin/payments/page.tsx`) migrated to surface panels, primary CTA hierarchy, and semantic financial state colors.
- Attendance workspace (`web/app/admin/attendance/page.tsx`) migrated to surface toolbars, semantic status toggles (present/absent/leave), muted row scanning, and tenant-primary save action.
- Admin overview dashboard (`web/app/admin/dashboard/page.tsx`) migrated to background/surface control-center layout, semantic trend indicators (growth/decline/neutral), and analytics-safe KPI hierarchy.
- Mobile Action dashboard container (`web/app/mobile/dashboard/page.tsx`) migrated to `bg-background` frame + `bg-surface border-border` top header/card surfaces while preserving existing functional action-tile colors.

### Wave 4 Execution (Forms & Tables)

Objective:

- Standardize form/table surface, border, and text hierarchy using tokens while preserving accessibility-critical interaction colors (focus/error/success states).

Execution order:

1. Shared form primitives (`input`, `select`, `textarea`, `form`).
2. Form section containers.
3. Label/helper text hierarchy.
4. Table structure and safe hover behavior.

Wave 4 kickoff note:

- Shared form primitives updated: `web/components/ui/input.tsx`, `web/components/ui/select.tsx`, `web/components/ui/textarea.tsx`, `web/components/ui/form.tsx`.
- Table structure baseline updated: `web/components/sx/sx-data-table.tsx`, `web/components/ui/table.tsx`.
- Focus, ring, and validation error colors intentionally unchanged for accessibility safety.

Wave 4 production audit:

- Shared-layer leverage order executed correctly (`primitives -> shared data table -> feature pages`) to minimize regression risk in live SaaS workflows.
- Input/select/textarea migration to `bg-surface` removes legacy white flashes and improves dark mode continuity.
- Placeholder hierarchy (`text-muted`) and form hierarchy (`label: text-sm font-medium`, `helper: text-muted text-xs`) now align with ERP data-entry UX.
- Shared table surface + `hover:bg-muted/40` establishes a consistent cross-theme grid interaction baseline.

Wave 4 next-pass strike plan (feature pass pending):

1. Fee module form containers (`fee setup`, concessions, transport fee, fine rules).
2. Student admission/onboarding form containers.
3. Remaining admin forms (`staff`, `class`, `subject`, related setup pages).
4. Page-level table wrappers on admin screens.

Feature-pass replacement patterns:

- Form section container: `bg-white ... rounded-lg` -> `bg-surface border border-border rounded-xl`.
- Page-level table wrapper: wrap table blocks in `bg-surface border border-border rounded-xl p-4`.

Do-not-touch guardrails for this pass:

- Charts and chart containers handled in Wave 3.
- Mobile action tile color logic (functional UX color system).
- Inline editable tables requiring separate interaction review.

Wave 4 final definition of done:

- No `bg-white` in form pages.
- All form sections use surface/border token wrappers.
- Page-level table wrappers are surface-based.
- Interaction colors (focus/error/success validation) remain unchanged.
- Validation visuals remain fully readable in light/dark mode.

Updated status:

- ✅ Wave 1 — UI primitives
- ✅ Wave 2 — App shells
- ✅ Wave 3 — Dashboards & ERP
- ✅ Wave 4 — Forms & tables (shared layer + feature pass complete)

### Wave 4 Final Execution Plan (Operational)

Objective (feature pages only):

- Eliminate remaining layout-level `bg-white`, `border-gray-*`, and `text-gray-*` usage in feature-page containers.
- Keep controls untouched; only migrate form section wrappers and page-level table wrappers.

Global search patterns:

- Find form containers: `bg-white p-6`, `bg-white p-4`, `bg-white rounded-lg`, `bg-white shadow-sm`.
- Replace with `bg-surface border border-border rounded-xl p-6` (or `bg-surface border border-border rounded-xl` where padding already exists).
- For table wrappers, wrap `DataTable`/table blocks inside `bg-surface border border-border rounded-xl p-4`.

Migration order (feature pass):

1. Financial admin screens (fee structure, concessions, fine rules, transport setup).
2. Admission/student management forms.
3. Academic configuration forms (classes, subjects, sections, timetable configs).
4. Remaining admin table pages (`filters -> table -> pagination` pattern).

Guardrails (locked):

- Do not modify charts/chart theming in this pass.
- Do not modify mobile action tile color system.
- Do not modify inline editable table interactions.
- Do not modify focus, error, or validation interaction colors.

Fast per-screen QA:

- Light mode: no white slabs; sections should match Daily Ops layering.
- Dark mode: no glowing white blocks; surfaces and borders remain consistent.

Production acceptance for Wave 4 complete:

- No `bg-white` in feature-page layout containers.
- All form sections wrapped in surface cards.
- All page-level tables wrapped in surface cards.
- No interaction/validation color regressions.
- No chart or mobile functional color regressions.
- Dark mode visual structure matches the Wave 3 dashboard baseline.

Commit discipline:

- `theme(forms): wrap fee module form sections in surface containers`
- `theme(tables): wrap student admin tables in surface containers`
- Keep commits scoped by feature group for rollback safety and auditability.

Wave 4 feature-pass progress:

- ✅ Pass 1 (financial admin screens) completed for:
  - `web/app/admin/finance/page.tsx`
  - `web/app/admin/finance/dashboard/page.tsx`
  - `web/app/admin/finance/posting/page.tsx`
- ✅ Pass 2 (admission/student management) completed for:
  - `web/app/admin/students/page.tsx`
  - `web/app/admin/enrollments/page.tsx`
- ✅ Pass 3 (academic configuration screens) completed for:
  - `web/app/admin/classes/page.tsx`
  - `web/app/admin/academic-years/page.tsx`
- ✅ Pass 4 (remaining admin table pages) completed for:
  - `web/app/admin/users/page.tsx`
  - `web/app/admin/campuses/page.tsx`
  - `web/app/admin/regions/page.tsx`
  - `web/app/admin/analytics/access-coverage/page.tsx`
  - `web/app/admin/jobs/page.tsx`
- Applied surface wrappers to form sections and page-level table blocks (`bg-surface border border-border rounded-xl`).
- Kept interaction/focus/validation colors unchanged.
- `web/app/admin/finance/challans/[id]/print/page.tsx` intentionally excluded in this pass because print output requires print-optimized white paper styling.

### 32. Theming Phase Complete + Governance Lock Roadmap

Theming phase status:

- ✅ Wave 1 — UI primitives
- ✅ Wave 2 — App shells
- ✅ Wave 3 — Dashboards & ERP
- ✅ Wave 4 — Forms & tables

Platform-level outcome:

- Token-governed layout and shared primitives (no hardcoded layout color usage in active admin/product surfaces).
- Runtime tenant theming with brand hierarchy (`Sairex shell -> tenant action identity -> system semantic meaning`).
- Dark-mode-safe structures across dashboard, ERP, forms, and tables.
- Operational UX improvements in core flows (attendance scanability, fee/payment clarity, dense-form readability).

### Theme Governance Lock (next phase)

Step 1 — ESLint token enforcement:

- Add guardrails to block hardcoded utility colors in UI layer (e.g. `bg-white`, `text-gray-*`, `border-gray-*`, `bg-blue-*`).
- Use lint failures as a hard stop for regressions.

Step 2 — Pull request checklist:

- Add `.github/pull_request_template.md` with token compliance checks:
  - no hardcoded Tailwind colors
  - surface/background token correctness
  - semantic status color correctness
  - tenant primary used only for action affordances

Step 3 — Blueprint development law:

- Add and enforce a permanent UI rule:
  - never use direct layout color utilities
  - use only `bg-surface`, `bg-background`, `text-muted`, `border-border`
  - use `bg-primary` for actions only
  - use `sx-*` semantic tokens for system status meaning

Step 4 — Monetize tenant branding:

- Convert branding capability into plan-gated features:
  - Starter: default/system branding
  - Professional: school logo + tenant primary actions
  - Enterprise: full branding suite (custom auth theme, domain mapping, mobile color sync)

Next delivery options:

- A — Implement Theme Governance Lock files (ESLint policy + PR template + blueprint enforcement section).
- B — Wire plan-based tenant branding permissions (backend guard + UI capability switch).
- C — Implement chart theme token system (dark mode + safe tenant accent mapping).

## 33. UI Governance Law (Enforced)

This section is the permanent UI law for token governance. New UI work must comply by default.

### Token-Only Color System

Hardcoded layout color utilities are forbidden.

Never use:

- `bg-white`
- `text-gray-*`
- `border-gray-*`
- `bg-blue-*`

Use only:

- `bg-background` -> page roots
- `bg-surface` -> cards and sections
- `text-muted` -> secondary text
- `border-border` -> dividers and boundaries
- `bg-primary` -> primary actions only

### Semantic System Colors (Platform Controlled)

System semantic colors are reserved for state meaning and are not tenant-overridden.

Use semantic colors for:

- financial states
- attendance states
- risk/alert indicators

Do not use tenant branding colors for any status meaning.

### Tenant Branding Scope

Tenant primary/accent colors are allowed only for:

- primary buttons
- active states
- non-semantic highlights

Tenant branding is not allowed for:

- status semantics
- analytics meaning colors
- validation/error semantics

### Enforcement Layers (Implemented)

- **ESLint token enforcement:** `web/eslint.config.mjs` blocks hardcoded banned classes in `app/admin/**` and `components/**`.
- **PR governance checklist:** `.github/pull_request_template.md` requires token compliance, semantic safety, and accessibility checks.
- **CI gate:** `.github/workflows/ci.yml` runs `npm run lint` before build/test, and failures block merge.

---

*End of Blueprint*
