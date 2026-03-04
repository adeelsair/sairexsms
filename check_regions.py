from prisma import Prisma
import asyncio

async def main():
    db = Prisma()
    await db.connect()
    
    regions = await db.region.find_many()
    print(f"\nRegions in database: {len(regions)}")
    for r in regions:
        print(f"  - {r.name} ({r.city})")
    
    campuses = await db.campus.find_many()
    print(f"\nCampuses in database: {len(campuses)}")
    for c in campuses[:10]:
        print(f"  - {c.name} (Region ID: {c.regionId})")
    
    await db.disconnect()

asyncio.run(main())
