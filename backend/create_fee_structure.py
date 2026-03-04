import asyncio
from prisma import Prisma

async def main() -> None:
    prisma = Prisma()
    await prisma.connect()

    # 1. Get Context (Org & Campus)
    org = await prisma.organization.find_unique(where={'orgCode': 'SAIR-GLOBAL'})
    campus = await prisma.campus.find_unique(where={'campusCode': 'ISB-01'})

    # 2. Get the "Monthly Tuition" Head we just seeded
    tuition_head = await prisma.feehead.find_first(
        where={
            'organizationId': org.id,
            'name': 'Monthly Tuition'
        }
    )

    if org and tuition_head and campus:
        # 3. Create the Rule
        structure = await prisma.feestructure.create(
            data={
                'organizationId': org.id,
                'campusId': campus.id,
                'feeHeadId': tuition_head.id,
                'name': 'Grade 10 - Standard Tuition (2026)',
                'amount': 5000.00,
                'frequency': 'MONTHLY',
                'applicableGrade': 'Grade 10'
            }
        )
        print(f"✅ FEE RULE CREATED:")
        print(f"   Name: {structure.name}")
        print(f"   Amount: {structure.amount} {structure.currency}")
        print(f"   Frequency: {structure.frequency}")
    else:
        print("Error: Could not find Organization, Fee Head, or Campus.")

    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
    