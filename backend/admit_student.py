import asyncio
from prisma import Prisma

async def main() -> None:
    prisma = Prisma()
    await prisma.connect()

    # 1. Find the Campus (Operational Boundary)
    campus = await prisma.campus.find_unique(where={'campusCode': 'ISB-01'})

    if campus:
        # 2. Create the student inside that campus
        student = await prisma.student.create(
            data={
                'fullName': 'Zain Sheikh',
                'admissionNo': 'ISB-2026-001',
                'grade': 'Grade 10',
                'organizationId': campus.organizationId, # Inherited from campus
                'campusId': campus.id
            }
        )
        print(f"✅ SUCCESS: {student.fullName} admitted to {campus.name}!")
    else:
        print("❌ ERROR: Campus not found. Run onboard_saas.py first.")

    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())