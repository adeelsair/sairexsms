import asyncio
from prisma import Prisma

async def main() -> None:
    prisma = Prisma()
    await prisma.connect()

    # 1. First, we find the school we created earlier
    school = await prisma.school.find_unique(where={'subdomain': 'sair'})

    if school:
        # 2. Add a student linked to this school's ID
        new_student = await prisma.student.create(
            data={
                'fullName': 'Ahmed Ali',
                'admissionNo': 'ST2026001',
                'grade': 'Class 5',
                'feeStatus': 'Unpaid',
                'schoolId': school.id, # This is the "Smart" link
            },
        )
        print(f"✅ SUCCESS: Student {new_student.fullName} admitted to {school.name}!")
        print(f"Admission No: {new_student.admissionNo}")
    else:
        print("❌ ERROR: School not found. Please run create_school.py first.")

    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())