import { getAttendanceRisks } from "@/lib/insights/attendance-risk.service";
import { getOperationalRiskInsight } from "@/lib/insights/operational-risk.service";
import { getPredictedDefaulters } from "@/lib/insights/predictive-fee.service";
import { getStudentStabilityOverview } from "@/lib/insights/student-stability.service";
import { prisma } from "@/lib/prisma";

export type PrincipalBrief = {
  text: string;
  generatedAt: Date;
};

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function endOfToday(): Date {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now;
}

export async function generatePrincipalBrief(
  organizationId: string,
): Promise<PrincipalBrief> {
  const [health, defaulters, attendance, stability] = await Promise.all([
    getOperationalRiskInsight(organizationId),
    getPredictedDefaulters({ organizationId }),
    getAttendanceRisks({ organizationId }),
    getStudentStabilityOverview({ organizationId }),
  ]);

  const highRiskStudents = stability.students.filter(
    (student) => student.stabilityScore < 50,
  ).length;

  const lines: string[] = [];
  lines.push(
    `School health score is ${health.score} and ${health.trend.toLowerCase()}.`,
  );

  if (highRiskStudents > 0) {
    lines.push(`${highRiskStudents} students show high instability risk.`);
  }

  if (defaulters.count > 0) {
    lines.push(`${defaulters.count} students likely to default next cycle.`);
  }

  if (attendance.clusters.length > 0) {
    lines.push(
      `Attendance concern emerging in ${attendance.clusters[0].className}.`,
    );
  }

  if (lines.length === 1) {
    lines.push("Operations are stable. No major risks detected.");
  } else {
    lines.push("Immediate attention recommended.");
  }

  return {
    generatedAt: new Date(),
    text: lines.join(" "),
  };
}

export async function getOrCreateDailyPrincipalBrief(
  organizationId: string,
): Promise<PrincipalBrief> {
  const existing = await prisma.operationalBriefSnapshot.findFirst({
    where: {
      organizationId,
      createdAt: {
        gte: startOfToday(),
        lte: endOfToday(),
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      text: true,
      createdAt: true,
    },
  });

  if (existing) {
    return {
      text: existing.text,
      generatedAt: existing.createdAt,
    };
  }

  const generated = await generatePrincipalBrief(organizationId);

  const created = await prisma.operationalBriefSnapshot.create({
    data: {
      organizationId,
      text: generated.text,
    },
    select: {
      text: true,
      createdAt: true,
    },
  });

  return {
    text: created.text,
    generatedAt: created.createdAt,
  };
}
