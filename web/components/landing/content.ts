export type LandingIconKey =
  | "graduationCap"
  | "userRoundCheck"
  | "creditCard"
  | "messageSquareMore"
  | "chartColumnBig"
  | "building2"
  | "school";

export const landingContent = {
  brand: {
    name: "SairexSMS",
    logoSrc: "/sairex-logo.png",
    logoAlt: "SairexSMS",
    versionLabel: "SAIREX SMS v1.0 (Enterprise)",
  },
  nav: {
    items: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Schools", href: "#schools" },
      { label: "Documentation", href: "#docs" },
    ],
    actions: {
      loginHref: "/login",
      signupHref: "/signup",
      signupLabel: "Start Free Trial",
    },
  },
  /** App host `/` — same brand as marketing, entry-only. */
  appEntry: {
    title: "Access your school workspace",
    subtitle:
      "Sign in to your dashboard, or create a new school account to get started.",
    audienceLine: "Secure school management and SMS automation — same product you see on our website.",
    primaryCta: { label: "Login", href: "/login" },
    secondaryCta: { label: "Start free trial", href: "/signup" },
  },
  hero: {
    title: "School Management & SMS Automation Platform",
    subtitle:
      "Manage admissions, attendance, fees and parent communication in one unified system built for schools in Pakistan.",
    audienceLine:
      "Built for school owners, principals, admin teams, and campus operators.",
    primaryCta: { label: "Start Free Trial", href: "/signup" },
    secondaryCta: { label: "Book Demo", href: "#pricing" },
    previewTitle: "Dashboard Preview",
    previewBadge: "Live Modules",
    previewCards: [
      { icon: "creditCard" as LandingIconKey, title: "Fee Dashboard", meta: "Due, paid, aging" },
      {
        icon: "userRoundCheck" as LandingIconKey,
        title: "Attendance",
        meta: "Daily class-wise tracking",
      },
      {
        icon: "messageSquareMore" as LandingIconKey,
        title: "SMS Alerts",
        meta: "Auto fee + absence alerts",
      },
      {
        icon: "graduationCap" as LandingIconKey,
        title: "Student List",
        meta: "Enrollment + records",
      },
    ],
  },
  trust: {
    title: "Trusted by schools across Pakistan",
    stats: [
      { value: "120+", label: "Schools" },
      { value: "65,000+", label: "Students Managed" },
      { value: "1.8M+", label: "SMS Sent" },
    ],
  },
  problemSolution: {
    problemTitle: "Common school problems",
    problemPoints: [
      "Manual fee registers and delayed follow-up",
      "Missed fee reminders and inconsistent parent outreach",
      "Attendance confusion across classes and campuses",
      "Parent communication spread across channels",
    ],
    solutionTitle: "How SairexSMS solves this",
    solutionPoints: [
      "Automated fee reminders and payment confirmations",
      "Attendance alerts sent to parents without manual effort",
      "Unified student and finance records for daily operations",
      "Digital workflows designed for school admin teams",
    ],
  },
  features: {
    sectionTitle: "Core Modules",
    sectionSubtitle:
      "Everything needed to run school operations and communication at scale.",
    items: [
      {
        icon: "graduationCap" as LandingIconKey,
        title: "Student Management",
        description: "Profiles, history, transfers and academic records in one place.",
      },
      {
        icon: "userRoundCheck" as LandingIconKey,
        title: "Attendance System",
        description: "Daily class attendance with clear status and school-wide visibility.",
      },
      {
        icon: "creditCard" as LandingIconKey,
        title: "Fee Management",
        description: "Challans, reminders, collections and payment receipts.",
      },
      {
        icon: "messageSquareMore" as LandingIconKey,
        title: "SMS Automation",
        description: "Automated parent notifications for fee dues, absences and updates.",
      },
      {
        icon: "chartColumnBig" as LandingIconKey,
        title: "Reports",
        description: "Academic and financial insights for better planning and control.",
      },
      {
        icon: "building2" as LandingIconKey,
        title: "Multi-Campus",
        description: "Operate multiple campuses with centralized governance.",
      },
    ],
  },
  workflow: {
    title: "How It Works",
    subtitle: "Start quickly without complex setup.",
    steps: [
      "Create your school account",
      "Add classes, staff and students",
      "Start attendance and fee operations",
      "Parents receive timely SMS updates",
    ],
  },
  screens: {
    title: "Product Screens",
    subtitle: "A quick look at dashboard, attendance, fee management, and SMS reports.",
    items: [
      { title: "Admin Dashboard", subtitle: "Daily operations, financial and risk overview." },
      { title: "Attendance Module", subtitle: "Class-wise attendance with instant tracking." },
      { title: "Fee Management", subtitle: "Challans, posting and defaulter workflows." },
      { title: "SMS Reports", subtitle: "Delivery logs and communication performance." },
    ],
  },
  pricing: {
    title: "Pricing",
    subtitle: "Simple plans designed for schools at every stage.",
    plans: [
      {
        name: "Starter",
        subtitle: "For small schools",
        students: "Up to 200 students",
        points: ["Student + attendance management", "Basic fee workflows", "Email support"],
        highlighted: false,
      },
      {
        name: "Professional",
        subtitle: "Most popular",
        students: "Up to 1000 students",
        points: ["Everything in Starter", "SMS automation", "Advanced reports"],
        highlighted: true,
      },
      {
        name: "Enterprise",
        subtitle: "For school groups",
        students: "Unlimited students",
        points: ["Everything in Professional", "Multi-campus controls", "Priority support"],
        highlighted: false,
      },
    ],
    trialLabel: "Start Free Trial",
    trialHref: "/signup",
  },
  testimonials: {
    title: "What schools say",
    subtitle: "Testimonial section is ready for live school quotes.",
    quote:
      "SairexSMS reduced our fee collection delays and made parent communication much faster.",
    author: "Pilot School, Lahore",
  },
  cta: {
    sectionId: "docs",
    title: "Ready to digitize your school?",
    subtitle:
      "Start free and move your admissions, attendance, fees, and communication workflows into one reliable platform.",
    primary: { label: "Start Free Trial", href: "/signup" },
    secondary: { label: "Request Demo", href: "#pricing" },
  },
  footer: {
    columns: [
      {
        title: "Product",
        links: [
          { label: "Features", href: "#features" },
          { label: "Pricing", href: "#pricing" },
          { label: "Updates", href: "#" },
        ],
      },
      {
        title: "Resources",
        links: [
          { label: "Docs", href: "#docs" },
          { label: "API", href: "#" },
          { label: "Help Center", href: "#" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About", href: "#" },
          { label: "Contact", href: "#" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Privacy", href: "#" },
          { label: "Terms", href: "#" },
        ],
      },
    ],
    rightLabel: "Powered by SAIR Technologies",
  },
} as const;
