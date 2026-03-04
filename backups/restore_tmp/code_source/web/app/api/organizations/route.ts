import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. POST: Create a new Organization
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, orgCode, plan } = body;

    // Validation
    if (!name || !orgCode) {
      return NextResponse.json({ error: 'Name and Code are required' }, { status: 400 });
    }

    // Create in Database
    const newOrg = await prisma.organization.create({
      data: {
        name,
        orgCode,
        subscriptionPlan: plan || 'FREE',
        subscriptionStatus: 'ACTIVE',
      },
    });

    return NextResponse.json(newOrg, { status: 201 });
  } catch (error) {
    console.error('Failed to create org:', error);
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}

// 2. GET: Fetch all Organizations (for the list)
export async function GET() {
  try {
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(orgs);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orgs' }, { status: 500 });
  }
}
