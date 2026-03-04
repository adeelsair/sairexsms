import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. GET: Fetch all Fee Categories
export async function GET() {
  try {
    const heads = await prisma.feeHead.findMany({
      include: { organization: true },
      orderBy: { id: 'desc' }
    });
    return NextResponse.json(heads);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch fee heads' }, { status: 500 });
  }
}

// 2. POST: Create a new Fee Category
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const head = await prisma.feeHead.create({
      data: {
        name: body.name,          // e.g., "Monthly Tuition"
        type: body.type,          // "RECURRING" or "ONE_TIME"
        organizationId: parseInt(body.organizationId),
        isSystemDefault: false    // Because a human is creating it manually
      }
    });
    
    return NextResponse.json(head, { status: 201 });
  } catch (error) {
    console.error("Fee Head Error:", error);
    return NextResponse.json({ error: 'Failed to create fee category' }, { status: 500 });
  }
}
