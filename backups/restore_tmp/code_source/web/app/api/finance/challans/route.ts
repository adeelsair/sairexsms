import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. GET: Fetch recent Challans (Invoices)
export async function GET() {
  try {
    const challans = await prisma.feeChallan.findMany({
      include: { 
        student: true,
        campus: true 
      },
      orderBy: { issueDate: 'desc' },
      take: 50 // Only load the 50 most recent for performance
    });
    return NextResponse.json(challans);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch challans' }, { status: 500 });
  }
}

// 2. POST: The Billing Engine (Generate Challans for a Batch)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organizationId, campusId, targetGrade, billingMonth, dueDate } = body;

    // A. Find all active students in this Campus & Grade
    const students = await prisma.student.findMany({
      where: {
        organizationId: parseInt(organizationId),
        campusId: parseInt(campusId),
        grade: targetGrade // e.g., "Grade 10"
      }
    });

    if (students.length === 0) {
      return NextResponse.json({ error: 'No students found in this grade.' }, { status: 404 });
    }

    // B. Find the Fee Rules for this Campus & Grade
    const rules = await prisma.feeStructure.findMany({
      where: {
        organizationId: parseInt(organizationId),
        campusId: parseInt(campusId),
        isActive: true,
        OR: [
          { applicableGrade: targetGrade },
          { applicableGrade: null }, // Apply rules meant for "All Grades"
          { applicableGrade: '' }
        ]
      }
    });

    if (rules.length === 0) {
      return NextResponse.json({ error: 'No fee rules found for this grade.' }, { status: 404 });
    }

    // C. Calculate Total Amount
    let totalBillAmount = 0;
    rules.forEach(rule => {
      totalBillAmount += Number(rule.amount);
    });

    // D. Generate Challans for Each Student
    let generatedCount = 0;
    const currentYear = new Date().getFullYear();

    for (const student of students) {
      // Create a unique Challan Number: CH-[CampusID]-[StudentID]-[Month][Year]
      const challanNo = `CH-${campusId}-${student.id}-${billingMonth.substring(0,3).toUpperCase()}${currentYear}`;

      // Check if this specific bill already exists (prevent double billing)
      const existing = await prisma.feeChallan.findUnique({
        where: { challanNo: challanNo }
      });

      if (!existing) {
        await prisma.feeChallan.create({
          data: {
            organizationId: parseInt(organizationId),
            campusId: parseInt(campusId),
            studentId: student.id,
            challanNo: challanNo,
            dueDate: new Date(dueDate), // Must be a valid date object
            totalAmount: totalBillAmount,
            status: 'UNPAID',
            generatedBy: 'SYSTEM_ADMIN' // In a real app, use the logged-in User ID
          }
        });
        generatedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Generated ${generatedCount} challans successfully.`,
      studentsFound: students.length 
    }, { status: 201 });

  } catch (error) {
    console.error("Billing Engine Error:", error);
    return NextResponse.json({ error: 'Failed to generate challans' }, { status: 500 });
  }
}

// 3. PUT: Process Payment for a Challan
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { challanId, paymentMethod } = body;

    // Fetch the bill to ensure we know how much they owe
    const challan = await prisma.feeChallan.findUnique({ 
      where: { id: parseInt(challanId) } 
    });

    if (!challan) {
      return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
    }
    if (challan.status === 'PAID') {
      return NextResponse.json({ error: 'Already paid' }, { status: 400 });
    }

    // Update the record as PAID
    const updatedChallan = await prisma.feeChallan.update({
      where: { id: parseInt(challanId) },
      data: {
        status: 'PAID',
        paidAmount: challan.totalAmount, // Assuming full payment for simplicity
        paymentMethod: paymentMethod,    // CASH, BANK_TRANSFER, etc.
        paidAt: new Date()
      }
    });

    return NextResponse.json({ success: true, message: 'Payment recorded successfully' });
  } catch (error) {
    console.error("Payment Error:", error);
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}
