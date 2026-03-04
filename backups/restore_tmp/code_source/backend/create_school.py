import asyncio
from prisma import Prisma

async def main() -> None:
    prisma = Prisma()
    await prisma.connect()

    # Create your first "Smart School"
    new_school = await prisma.school.create(
        data={
            'name': 'Sair Academy',
            'subdomain': 'sair',
        },
    )

    print(f"✅ SUCCESS: School created!")
    print(f"ID: {new_school.id}")
    print(f"Name: {new_school.name}")
    print(f"Subdomain: {new_school.subdomain}.sairexsms.com")

    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())