// ─── Organization Validation Schemas ─────────────────────────────────────────

// Organization
export {
  createOrganizationSchema,
  updateOrganizationSchema,
  ORGANIZATION_CATEGORY,
  ORGANIZATION_STRUCTURE,
  ORGANIZATION_STATUS,
  type CreateOrganizationInput,
  type CreateOrganizationData,
  type UpdateOrganizationInput,
  type UpdateOrganizationData,
} from "./organization";

// Organization Contact
export {
  createOrganizationContactSchema,
  updateOrganizationContactSchema,
  type CreateOrganizationContactInput,
  type CreateOrganizationContactData,
  type UpdateOrganizationContactInput,
  type UpdateOrganizationContactData,
} from "./organization-contact";

// Organization Address
export {
  createOrganizationAddressSchema,
  updateOrganizationAddressSchema,
  ADDRESS_TYPE,
  PAKISTAN_PROVINCES,
  type CreateOrganizationAddressInput,
  type CreateOrganizationAddressData,
  type UpdateOrganizationAddressInput,
  type UpdateOrganizationAddressData,
} from "./organization-address";

// Signup / Register
export {
  signupSchema,
  type SignupInput,
  type SignupData,
} from "./signup";

// Class & Section
export {
  createClassSchema,
  createSectionSchema,
  type CreateClassInput,
  type CreateClassData,
  type CreateSectionInput,
  type CreateSectionData,
} from "./class-section";

// Academic Year
export {
  academicYearSchema,
  ACADEMIC_YEAR_STATUS,
  type AcademicYearInput,
  type AcademicYearData,
} from "./academic-year";

// Onboarding (4-step wizard)
export {
  onboardingIdentitySchema,
  onboardingLegalSchema,
  onboardingContactAddressSchema,
  onboardingBrandingSchema,
  onboardingCompleteSchema,
  ONBOARDING_ORGANIZATION_CATEGORY,
  ONBOARDING_ORGANIZATION_STRUCTURE,
  type OnboardingIdentityInput,
  type OnboardingIdentityData,
  type OnboardingLegalInput,
  type OnboardingLegalData,
  type OnboardingContactAddressInput,
  type OnboardingContactAddressData,
  type OnboardingBrandingInput,
  type OnboardingBrandingData,
  type OnboardingCompleteInput,
  type OnboardingCompleteData,
} from "./onboarding";

// Payment Entry
export {
  paymentEntrySchema,
  type PaymentEntryInput,
} from "./payment-entry";

// Billing Config
export {
  billingConfigSchema,
  billingConfigUpdateSchema,
  type BillingConfigInput,
  type BillingConfigUpdateInput,
} from "./billing-config";
