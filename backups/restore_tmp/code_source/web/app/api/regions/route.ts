import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const regions = await prisma.regionalOffice.findMany({
    include: { organization: true }
  });
  return NextResponse.json(regions);
}

export async function POST(request: Request) {
  const body = await request.json();
  const region = await prisma.regionalOffice.create({
    data: {
      name: body.name,
      city: body.city,
      organizationId: parseInt(body.organizationId),
    }
  });
  return NextResponse.json(region);
}
