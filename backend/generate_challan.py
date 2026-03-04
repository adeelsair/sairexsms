import asyncio
from datetime import datetime, timedelta
from prisma import Prisma

async def main() -> None:
    prisma = Prisma()
    await prisma.connect()

    # 1. Find or create our Student (Zain)
    # In a real app, you would loop through ALL students in Grade 10
    student = await prisma.student.find_first(
        where={
            'admissionNo': 'ISB-2026-001', # Zain's Admission Number
            'grade': 'Grade 10',
        },
    )

    if not student:
        campus = await prisma.campus.find_unique(where={'campusCode': 'ISB-01'})
        if not campus:
            print("Error: Campus not found. Run onboard_saas.py first.")
            await prisma.disconnect()
            return

        student = await prisma.student.upsert(
            where={'admissionNo': 'ISB-2026-001'},
            data={
                'create': {
                    'fullName': 'Zain Sheikh',
                    'admissionNo': 'ISB-2026-001',
                    'grade': 'Grade 10',
                    'organizationId': campus.organizationId,
                    'campusId': campus.id,
                },
                'update': {
                    'fullName': 'Zain Sheikh',
                    'grade': 'Grade 10',
                    'organizationId': campus.organizationId,
                    'campusId': campus.id,
                },
            },
        )

    # 2. Find the applicable Fee Structure for his Grade
    # We look for the "Standard Tuition" we created in the last step
    fee_rule = await prisma.feestructure.find_first(
        where={
            'campusId': student.campusId,
            'applicableGrade': 'Grade 10',
            'frequency': 'MONTHLY'
        }
    )

    if not fee_rule:
        print("Error: No Fee Rule found for Grade 10.")
        await prisma.disconnect()
        return

    # 3. Generate the Challan
    # We create a unique Challan Number (e.g., CH-ISB-001)
    # In a real app, use a random number generator here
    challan_no = f"CH-{student.admissionNo}-FEB26"
    
    # Set Due Date to 10 days from now
    due_date = datetime.now() + timedelta(days=10)

    try:
        challan = await prisma.feechallan.create(
            data={
                'organizationId': student.organizationId,
                'campusId': student.campusId,
                'studentId': student.id,
                'challanNo': challan_no,
                'totalAmount': fee_rule.amount,
                'dueDate': due_date,
                'status': 'UNPAID',
                'generatedBy': 'SYSTEM_AUTO'
            }
        )

        print("BILL GENERATED SUCCESSFULLY!")
        print(f"   Student: {student.fullName}")
        print(f"   Challan No: {challan.challanNo}")
        print(f"   Amount Due: {challan.totalAmount}")
        print(f"   Due Date: {challan.dueDate.strftime('%Y-%m-%d')}")

    except Exception as e:
        print(f"Error generating bill: {e}")

    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
    