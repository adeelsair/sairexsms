import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. GET: Fetch all Pricing Rules
export async function GET() {
  try {
    const structures = await prisma.feeStructure.findMany({
      include: { 
        organization: true,
        campus: true,
        feeHead: true
      },
      orderBy: { id: 'desc' }
    });
    return NextResponse.json(structures);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
  }
}

// 2. POST: Create a new Pricing Rule
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const structure = await prisma.feeStructure.create({
      data: {
        name: body.name,                 // e.g., "Grade 10 - Standard Tuition"
        amount: parseFloat(body.amount), // Converts "5000" to a decimal
        frequency: body.frequency,       // "MONTHLY", "ONCE", "ANNUAL"
        applicableGrade: body.applicableGrade || null, // Optional filter
        organizationId: parseInt(body.organizationId),
        campusId: parseInt(body.campusId),
        feeHeadId: parseInt(body.feeHeadId)
      }
    });
    
    return NextResponse.json(structure, { status: 201 });
  } catch (error) {
    console.error("Pricing Rule Error:", error);
    return NextResponse.json({ error: 'Failed to create pricing rule' }, { status: 500 });
  }
}
