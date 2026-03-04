import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  primary: "#1a56db",
  primaryLight: "#e8eefb",
  dark: "#111827",
  darkSoft: "#1f2937",
  muted: "#6b7280",
  mutedLight: "#9ca3af",
  border: "#d1d5db",
  borderLight: "#e5e7eb",
  white: "#ffffff",
  bg: "#f9fafb",
  gold: "#b8860b",
  goldDark: "#8b6914",
  goldLight: "#d4a843",
};

/* ── PAGE 1: CERTIFICATE ────────────────────────────────────── */

export const cert = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: "Helvetica",
    backgroundColor: colors.white,
    position: "relative",
  },

  outerBorder: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderWidth: 3,
    borderColor: colors.gold,
    borderStyle: "solid",
  },

  innerBorder: {
    position: "absolute",
    top: 22,
    left: 22,
    right: 22,
    bottom: 22,
    borderWidth: 0.75,
    borderColor: colors.goldLight,
    borderStyle: "solid",
  },

  watermark: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: 120,
    fontFamily: "Helvetica-Bold",
    color: colors.borderLight,
    opacity: 0.06,
    letterSpacing: 8,
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 80,
    paddingVertical: 30,
  },

  issuer: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    letterSpacing: 6,
    marginBottom: 4,
  },

  issuerSub: {
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 2,
    marginBottom: 14,
  },

  dividerGold: {
    width: 160,
    height: 1.5,
    backgroundColor: colors.gold,
    marginVertical: 10,
  },

  dividerThin: {
    width: 100,
    height: 0.5,
    backgroundColor: colors.goldLight,
    marginVertical: 10,
  },

  title: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: colors.gold,
    letterSpacing: 3,
    marginBottom: 12,
  },

  certifyText: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
  },

  orgName: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginVertical: 6,
    textAlign: "center",
  },

  regIdLabel: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 8,
    letterSpacing: 1,
  },

  regId: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    letterSpacing: 2,
    marginTop: 2,
    marginBottom: 8,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 30,
    marginTop: 6,
    marginBottom: 4,
  },

  metaItem: {
    alignItems: "center",
  },

  metaLabel: {
    fontSize: 7,
    color: colors.mutedLight,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },

  metaValue: {
    fontSize: 10,
    color: colors.darkSoft,
    fontFamily: "Helvetica-Bold",
  },

  certNoLabel: {
    fontSize: 8,
    color: colors.mutedLight,
    letterSpacing: 1,
    marginTop: 8,
  },

  certNo: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.goldDark,
    letterSpacing: 1.5,
    marginTop: 2,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    width: "100%",
    marginTop: 14,
    paddingHorizontal: 40,
  },

  sealCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },

  sealText: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: colors.gold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  sealMain: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.gold,
    marginVertical: 2,
  },

  qrArea: {
    alignItems: "center",
    width: 110,
  },

  qrImage: {
    width: 56,
    height: 56,
  },

  qrLabel: {
    fontSize: 6.5,
    color: colors.muted,
    marginTop: 3,
    fontFamily: "Helvetica-Bold",
  },

  qrUrl: {
    fontSize: 5.5,
    color: colors.mutedLight,
    marginTop: 1,
    textAlign: "center",
  },

  centerStamp: {
    alignItems: "center",
    flex: 1,
    gap: 6,
  },

  signArea: {
    alignItems: "center",
    width: 140,
  },

  signLine: {
    width: 120,
    height: 0.5,
    backgroundColor: colors.muted,
    marginBottom: 4,
  },

  signLabel: {
    fontSize: 7,
    color: colors.muted,
  },

  stampNote: {
    fontSize: 7,
    color: colors.mutedLight,
    fontFamily: "Helvetica-Oblique",
    textAlign: "center",
    marginTop: 4,
  },

  footer: {
    position: "absolute",
    bottom: 28,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  footerText: {
    fontSize: 6.5,
    color: colors.mutedLight,
  },
});

/* ── PAGE 2: ORGANIZATION PROFILE ───────────────────────────── */

export const profile = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    backgroundColor: colors.white,
    position: "relative",
  },

  topLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.primary,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },

  headerTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
  },

  headerSub: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 2,
  },

  headerRight: {
    alignItems: "flex-end",
  },

  headerRegId: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    letterSpacing: 1,
  },

  headerCertNo: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.goldDark,
    marginTop: 1,
  },

  headerDate: {
    fontSize: 7.5,
    color: colors.muted,
    marginTop: 2,
  },

  grid: {
    flexDirection: "row",
    gap: 20,
  },

  column: {
    flex: 1,
  },

  section: {
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.goldLight,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },

  row: {
    flexDirection: "row",
    marginBottom: 4,
    paddingVertical: 1,
  },

  label: {
    fontSize: 7.5,
    color: colors.muted,
    width: 100,
  },

  value: {
    fontSize: 8.5,
    color: colors.dark,
    flex: 1,
    fontFamily: "Helvetica-Bold",
  },

  valueMuted: {
    fontSize: 8.5,
    color: colors.mutedLight,
    flex: 1,
    fontFamily: "Helvetica-Oblique",
  },

  valueMono: {
    fontSize: 8.5,
    color: colors.primary,
    flex: 1,
    fontFamily: "Courier-Bold",
    letterSpacing: 0.5,
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderLight,
    paddingTop: 8,
  },

  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  footerText: {
    fontSize: 6.5,
    color: colors.mutedLight,
  },

  footerNote: {
    fontSize: 6,
    color: colors.mutedLight,
    fontFamily: "Helvetica-Oblique",
    textAlign: "center",
    marginTop: 4,
  },
});
