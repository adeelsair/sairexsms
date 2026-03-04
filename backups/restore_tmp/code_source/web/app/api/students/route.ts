import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. GET: Fetch all students (with their campus names)
export async function GET() {
  try {
    const students = await prisma.student.findMany({
      include: { 
        campus: true,
        organization: true 
      },
      orderBy: { id: 'desc' }
    });
    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

// 2. POST: Admit a new student
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Create the student in the database
    const student = await prisma.student.create({
      data: {
        fullName: body.fullName,
        admissionNo: body.admissionNo,
        grade: body.grade,
        organizationId: parseInt(body.organizationId),
        campusId: parseInt(body.campusId),
        feeStatus: 'Unpaid' // Default status on admission
      }
    });
    
    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('Failed to admit student:', error);
    return NextResponse.json({ error: 'Failed to admit student' }, { status: 500 });
  }
}
