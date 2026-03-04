import asyncio
from prisma import Prisma

async def main() -> None:
    prisma = Prisma()
    await prisma.connect()

    # Fetch all organizations and include their campuses and students
    orgs = await prisma.organization.find_many(include={'campuses': True, 'students': True})

    for org in orgs:
        print(f"\n🏢 Organization: {org.name}")
        for campus in org.campuses:
            print(f"  📍 Campus: {campus.name} ({campus.city})")
        
        print(f"  🎓 Total Students in Org: {len(org.students)}")

    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())