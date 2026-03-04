import asyncio
from prisma import Prisma

# The "Global Templates" (Hardcoded Standards)
DEFAULT_FEE_TEMPLATES = [
    {"name": "Admission Fee", "type": "ONE_TIME"},
    {"name": "Monthly Tuition", "type": "RECURRING"},
    {"name": "Annual Development Charge", "type": "RECURRING"},
    {"name": "Examination Fee", "type": "RECURRING"},
    {"name": "Security Deposit (Refundable)", "type": "ONE_TIME"},
]

async def main() -> None:
    prisma = Prisma()
    await prisma.connect()

    # 1. Get our Organization (Sair Global Education)
    # In a real app, you would pass the specific org_id here
    org = await prisma.organization.find_unique(where={'orgCode': 'SAIR-GLOBAL'})

    if not org:
        print("Organization not found. Run onboard_saas.py first.")
        return

    print(f"Seeding Fee Templates for: {org.name}...")

    # 2. Loop through templates and create them for this school
    count = 0
    for template in DEFAULT_FEE_TEMPLATES:
        # Check if it already exists to avoid duplicates
        exists = await prisma.feehead.find_first(
            where={
                'organizationId': org.id,
                'name': template['name']
            }
        )

        if not exists:
            await prisma.feehead.create(
                data={
                    'organizationId': org.id,
                    'name': template['name'],
                    'type': template['type'],
                    'isSystemDefault': True
                }
            )
            print(f"   Created Head: {template['name']} ({template['type']})")
            count += 1
        else:
            print(f"   Skipped: {template['name']} (Already exists)")

    print(f"Done! Added {count} fee heads.")

    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
    