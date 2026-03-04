import asyncio
import site
import sys

# Ensure user site-packages is available for the generated Prisma client.
user_site = site.getusersitepackages()
if user_site and user_site not in sys.path:
    sys.path.insert(0, user_site)

from prisma import Prisma

async def main() -> None:
    prisma = Prisma()
    await prisma.connect()

    # 1. Create or reuse the Root Organization
    org = await prisma.organization.upsert(
        where={
            'orgCode': 'SAIR-GLOBAL',
        },
        data={
            'create': {
                'name': 'Sair Global Education',
                'orgCode': 'SAIR-GLOBAL',
                'subscriptionPlan': 'PRO',
            },
            'update': {
                'name': 'Sair Global Education',
                'subscriptionPlan': 'PRO',
            },
        },
    )

    # 2. Create or reuse the Main Campus
    campus = await prisma.campus.upsert(
        where={
            'campusCode': 'ISB-01',
        },
        data={
            'create': {
                'organizationId': org.id,
                'name': 'Islamabad City Campus',
                'campusCode': 'ISB-01',
                'campusSlug': 'islamabad-main',
                'city': 'Islamabad',
                'isMainCampus': True,
            },
            'update': {
                'organizationId': org.id,
                'name': 'Islamabad City Campus',
                'campusSlug': 'islamabad-main',
                'city': 'Islamabad',
                'isMainCampus': True,
            },
        },
    )

    # 3. Create or reuse the Org Admin User
    user = await prisma.user.upsert(
        where={
            'email': 'admin@sair.com',
        },
        data={
            'create': {
                'organizationId': org.id,
                'campusId': campus.id,
                'email': 'admin@sair.com',
                'password': 'securepassword123', # We will hash this later!
                'role': 'ORG_ADMIN',
            },
            'update': {
                'organizationId': org.id,
                'campusId': campus.id,
                'password': 'securepassword123', # We will hash this later!
                'role': 'ORG_ADMIN',
            },
        },
    )

    print("SaaS Setup Complete!")
    print(f"Org: {org.name} | Campus: {campus.name} | Admin: {user.email}")

    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())