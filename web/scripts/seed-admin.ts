/**
 * Seed Script: Creates the root Organization (flat model), SUPER_ADMIN user,
 * ORG_ADMIN membership, and organization ID sequence.
 *
 * Run with:  npx tsx scripts/seed-admin.ts
 */

import { PrismaClient } from "../lib/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("--- SAIREX SMS: Seeding Super Admin ---\n");

  // 0. Initialize the Organization ID sequence
  await prisma.organizationSequence.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, lastValue: 1 },
  });
  console.log("Sequence    : OrganizationSequence initialized (lastValue: 1)");

  // 1. Hash the default password
  const defaultPassword = "Admin@123";
  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  // 2. Upsert the SUPER_ADMIN user (global identity with platformRole)
  const admin = await prisma.user.upsert({
    where: { email: "admin@sairex-sms.com" },
    update: { password: hashedPassword, platformRole: "SUPER_ADMIN" },
    create: {
      name: "System Administrator",
      email: "admin@sairex-sms.com",
      password: hashedPassword,
      isActive: true,
      emailVerifiedAt: new Date(),
      platformRole: "SUPER_ADMIN",
    },
  });
  console.log(`Super Admin : ${admin.email} (id: ${admin.id}, platformRole: ${admin.platformRole})`);

  // 3. Upsert the root organization (flat single-table model)
  const org = await prisma.organization.upsert({
    where: { slug: "sairex-hq" },
    update: {},
    create: {
      id: "ORG-00001",
      slug: "sairex-hq",
      status: "ACTIVE",
      onboardingStep: "COMPLETED",
      createdByUserId: admin.id,

      // Core Identity
      organizationName: "Sairex Headquarters",
      displayName: "Sairex HQ",
      organizationCategory: "ACADEMY",
      organizationStructure: "SINGLE",

      // Legal
      registrationNumber: "N/A",
      taxNumber: "N/A",
      establishedDate: new Date("2024-01-01"),

      // HQ Address
      addressLine1: "123 Main Boulevard, DHA Phase 5",
      country: "Pakistan",
      provinceState: "Punjab",
      city: "Lahore",
      postalCode: "54000",

      // Contact
      organizationEmail: "admin@sairex-sms.com",
      organizationPhone: "042-1234567",
    },
  });
  console.log(`Organization: "${org.organizationName}" (id: ${org.id})`);

  // 4. Create Membership (User <-> Organization with ORG_ADMIN role)
  const membership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: admin.id,
        organizationId: org.id,
      },
    },
    update: { role: "ORG_ADMIN", status: "ACTIVE" },
    create: {
      userId: admin.id,
      organizationId: org.id,
      role: "ORG_ADMIN",
      status: "ACTIVE",
    },
  });
  console.log(`Membership  : ${membership.role} in ${org.displayName}`);

  // 5. Upsert a default city for the organization
  let city = await prisma.city.findFirst({
    where: { organizationId: org.id, name: "Lahore" },
  });
  if (!city) {
    city = await prisma.city.create({
      data: {
        name: "Lahore",
        unitCode: "LHR",
        organizationId: org.id,
      },
    });
  }
  console.log(`City        : "${city.name}" (id: ${city.id})`);

  // 6. Upsert a default campus for the organization
  let campus = await prisma.campus.findFirst({
    where: { campusCode: "MAIN" },
  });
  if (!campus) {
    campus = await prisma.campus.create({
      data: {
        organizationId: org.id,
        name: "Main Campus",
        campusCode: "MAIN",
        campusSlug: "main-campus",
        unitCode: "MAIN",
        fullUnitPath: "ORG-00001-LHR-MAIN",
        cityId: city.id,
        isMainCampus: true,
        status: "ACTIVE",
      },
    });
  }
  console.log(`Campus      : "${campus.name}" (id: ${campus.id}, code: ${campus.campusCode})`);

  console.log("\n========================================");
  console.log("  LOGIN CREDENTIALS");
  console.log("========================================");
  console.log(`  Email    : admin@sairex-sms.com`);
  console.log(`  Password : ${defaultPassword}`);
  console.log(`  Platform : SUPER_ADMIN`);
  console.log("========================================");
  console.log("\n  Change this password after first login!\n");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
