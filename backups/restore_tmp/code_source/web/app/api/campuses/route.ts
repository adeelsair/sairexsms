import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const campuses = await prisma.campus.findMany({
    include: { organization: true, region: true }
  });
  return NextResponse.json(campuses);
}

export async function POST(request: Request) {
  const body = await request.json();
  const campus = await prisma.campus.create({
    data: {
      name: body.name,
      campusCode: body.campusCode,
      campusSlug: body.campusCode.toLowerCase(),
      city: body.city,
      organizationId: parseInt(body.organizationId),
      regionId: body.regionId ? parseInt(body.regionId) : null,
    }
  });
  return NextResponse.json(campus);
}
