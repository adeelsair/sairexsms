import React from "react";
import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { cert, profile } from "./styles";

export interface OrgPdfData {
  id: string;
  slug: string;
  organizationName: string;
  displayName: string;
  organizationCategory: string;
  organizationStructure: string;
  registrationNumber: string | null;
  taxNumber: string | null;
  establishedDate: Date | string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  country: string | null;
  provinceState: string | null;
  district: string | null;
  tehsil: string | null;
  city: string | null;
  postalCode: string | null;
  organizationEmail: string | null;
  organizationPhone: string | null;
  organizationMobile: string | null;
  organizationWhatsApp: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  createdAt: Date | string;
}

function humanize(value: string | null): string {
  if (!value) return "\u2014";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(value: string | null | undefined): string {
  return value || "\u2014";
}

function fmtDate(value: Date | string | null): string {
  if (!value) return "\u2014";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function generateCertNo(orgId: string, createdAt: Date | string): string {
  const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const year = d.getFullYear();
  const seq = orgId.replace(/\D/g, "").padStart(6, "0");
  return `SRC-${year}-${seq}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={profile.row}>
      <Text style={profile.label}>{label}</Text>
      <Text style={value === "\u2014" ? profile.valueMuted : profile.value}>
        {value}
      </Text>
    </View>
  );
}

function MonoField({ label, value }: { label: string; value: string }) {
  return (
    <View style={profile.row}>
      <Text style={profile.label}>{label}</Text>
      <Text style={value === "\u2014" ? profile.valueMuted : profile.valueMono}>
        {value}
      </Text>
    </View>
  );
}

interface PdfProps {
  org: OrgPdfData;
  qrDataUrl?: string;
  verifyUrl?: string;
}

export default function RegistrationPDF({ org, qrDataUrl, verifyUrl }: PdfProps) {
  const regDate = fmtDate(org.createdAt);
  const certNo = generateCertNo(org.id, org.createdAt);
  const now = new Date();
  const timestamp = `${now.toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" })} at ${now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}`;

  return (
    <Document
      title={`${org.id} \u2014 Registration Certificate`}
      author="SAIREX SMS"
      subject="Organization Registration Certificate"
      keywords={`${org.id}, ${certNo}, SAIREX`}
    >
      {/* ══════════════════════════════════════════════════════════
          PAGE 1: REGISTRATION CERTIFICATE
          ══════════════════════════════════════════════════════════ */}
      <Page size="A4" orientation="landscape" style={cert.page}>
        <View style={cert.outerBorder} />
        <View style={cert.innerBorder} />

        {/* Watermark */}
        <Text style={cert.watermark}>SAIREX</Text>

        <View style={cert.content}>
          {/* Issuer */}
          <Text style={cert.issuer}>SAIREX SMS</Text>
          <Text style={cert.issuerSub}>School Management System</Text>

          <View style={cert.dividerGold} />

          {/* Title */}
          <Text style={cert.title}>REGISTRATION CERTIFICATE</Text>

          {/* Body */}
          <Text style={cert.certifyText}>
            This is to certify that the organization
          </Text>

          <Text style={cert.orgName}>{org.organizationName}</Text>

          <Text style={cert.certifyText}>
            has been successfully registered on the SAIREX SMS platform
          </Text>

          {/* Registration ID */}
          <Text style={cert.regIdLabel}>REGISTRATION ID</Text>
          <Text style={cert.regId}>{org.id}</Text>

          <View style={cert.dividerThin} />

          {/* Meta row */}
          <View style={cert.metaRow}>
            <View style={cert.metaItem}>
              <Text style={cert.metaLabel}>Registration Date</Text>
              <Text style={cert.metaValue}>{regDate}</Text>
            </View>
            <View style={cert.metaItem}>
              <Text style={cert.metaLabel}>Category</Text>
              <Text style={cert.metaValue}>
                {humanize(org.organizationCategory)}
              </Text>
            </View>
            <View style={cert.metaItem}>
              <Text style={cert.metaLabel}>Structure</Text>
              <Text style={cert.metaValue}>
                {humanize(org.organizationStructure)}
              </Text>
            </View>
          </View>

          {/* Certificate Number */}
          <Text style={cert.certNoLabel}>CERTIFICATE NO.</Text>
          <Text style={cert.certNo}>{certNo}</Text>

          {/* QR + Seal + Signature area */}
          <View style={cert.bottomRow}>
            {/* QR Code */}
            <View style={cert.qrArea}>
              {qrDataUrl ? (
                <>
                  <Image src={qrDataUrl} style={cert.qrImage} />
                  <Text style={cert.qrLabel}>Scan to Verify</Text>
                  {verifyUrl && (
                    <Text style={cert.qrUrl}>{verifyUrl}</Text>
                  )}
                </>
              ) : (
                <View style={cert.sealCircle}>
                  <Text style={cert.sealText}>Sairex</Text>
                  <Text style={cert.sealMain}>SMS</Text>
                  <Text style={cert.sealText}>Verified</Text>
                </View>
              )}
            </View>

            {/* System stamp note */}
            <View style={cert.centerStamp}>
              <View style={cert.sealCircle}>
                <Text style={cert.sealText}>Sairex</Text>
                <Text style={cert.sealMain}>SMS</Text>
                <Text style={cert.sealText}>Verified</Text>
              </View>
              <Text style={cert.stampNote}>
                System-generated certificate.{"\n"}
                No physical signature required.
              </Text>
            </View>

            {/* Authorized signature */}
            <View style={cert.signArea}>
              <View style={cert.signLine} />
              <Text style={cert.signLabel}>Authorized Digital Stamp</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={cert.footer}>
          <Text style={cert.footerText}>
            SAIREX SMS \u2014 Powered by Sairex Technologies
          </Text>
          <Text style={cert.footerText}>
            www.sairex-sms.com
          </Text>
          <Text style={cert.footerText}>
            Certificate: {certNo} | Document v1.0
          </Text>
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════════
          PAGE 2: ORGANIZATION PROFILE
          ══════════════════════════════════════════════════════════ */}
      <Page size="A4" orientation="landscape" style={profile.page}>
        <View style={profile.topLine} />

        {/* Header */}
        <View style={profile.header}>
          <View>
            <Text style={profile.headerTitle}>Organization Profile</Text>
            <Text style={profile.headerSub}>{org.organizationName}</Text>
          </View>
          <View style={profile.headerRight}>
            <Text style={profile.headerRegId}>{org.id}</Text>
            <Text style={profile.headerCertNo}>{certNo}</Text>
            <Text style={profile.headerDate}>Registered: {regDate}</Text>
          </View>
        </View>

        {/* Two-column grid with 4 sections */}
        <View style={profile.grid}>
          {/* LEFT COLUMN */}
          <View style={profile.column}>
            {/* Basic Information */}
            <View style={profile.section}>
              <Text style={profile.sectionTitle}>Basic Information</Text>
              <Field
                label="Organization Name"
                value={fmt(org.organizationName)}
              />
              <Field label="Display Name" value={fmt(org.displayName)} />
              <Field label="Slug" value={fmt(org.slug)} />
              <Field
                label="Category"
                value={humanize(org.organizationCategory)}
              />
              <Field
                label="Structure"
                value={humanize(org.organizationStructure)}
              />
              <MonoField label="Registration ID" value={org.id} />
              <MonoField label="Certificate No." value={certNo} />
            </View>

            {/* Address Information */}
            <View style={profile.section}>
              <Text style={profile.sectionTitle}>
                Head Office Address
              </Text>
              <Field label="Street Address" value={fmt(org.addressLine1)} />
              <Field label="Address Line 2" value={fmt(org.addressLine2)} />
              <Field label="City" value={fmt(org.city)} />
              <Field label="District" value={fmt(org.district)} />
              <Field label="Tehsil" value={fmt(org.tehsil)} />
              <Field label="Province" value={fmt(org.provinceState)} />
              <Field label="Country" value={fmt(org.country)} />
              <Field label="Postal Code" value={fmt(org.postalCode)} />
            </View>
          </View>

          {/* RIGHT COLUMN */}
          <View style={profile.column}>
            {/* Contact Information */}
            <View style={profile.section}>
              <Text style={profile.sectionTitle}>Contact Information</Text>
              <Field
                label="Official Email"
                value={fmt(org.organizationEmail)}
              />
              <Field
                label="Land Line Number"
                value={fmt(org.organizationPhone)}
              />
              <Field
                label="Mobile Number"
                value={fmt(org.organizationMobile)}
              />
              <Field label="WhatsApp" value={fmt(org.organizationWhatsApp)} />
              <Field label="Website" value={fmt(org.websiteUrl)} />
            </View>

            {/* Compliance / Legal */}
            <View style={profile.section}>
              <Text style={profile.sectionTitle}>Compliance / Legal</Text>
              <Field
                label="Registration No."
                value={fmt(org.registrationNumber)}
              />
              <Field label="Tax / NTN Number" value={fmt(org.taxNumber)} />
              <Field
                label="Established Date"
                value={fmtDate(org.establishedDate)}
              />
            </View>

            {/* Branding */}
            <View style={profile.section}>
              <Text style={profile.sectionTitle}>Branding</Text>
              <Field
                label="Logo"
                value={org.logoUrl ? "Uploaded" : "Not provided"}
              />
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={profile.footer}>
          <View style={profile.footerRow}>
            <Text style={profile.footerText}>
              SAIREX SMS \u2014 School Management System
            </Text>
            <Text style={profile.footerText}>
              Generated: {timestamp}
            </Text>
            <Text style={profile.footerText}>
              {certNo} | Document v1.0
            </Text>
          </View>
          <Text style={profile.footerNote}>
            System-generated document \u2014 No physical signature required.
            This document remains property of SAIREX SMS.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
