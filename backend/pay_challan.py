import asyncio
from datetime import datetime
from prisma import Prisma
# IMPORT THE NEW SERVICE
from notification_service import send_sms_alert

async def main() -> None:
    prisma = Prisma()
    await prisma.connect()

    challan_no = input("Enter Challan No (e.g., CH-ISB-2026-001-FEB26): ")

    # Find the Bill (include student for SMS details)
    bill = await prisma.feechallan.find_unique(
        where={'challanNo': challan_no},
        include={'student': True},
    )

    if not bill:
        print("ERROR: Bill not found.")
        await prisma.disconnect()
        return

    if bill.status == 'PAID':
        print("WARN: This bill is already paid!")
        await prisma.disconnect()
        return

    print(f"Found Bill for: {bill.student.fullName} (Amount: {bill.totalAmount})")
    confirm = input("Confirm payment? (y/n): ")

    if confirm.lower() == 'y':
        await prisma.feechallan.update(
            where={'id': bill.id},
            data={
                'status': 'PAID',
                'paidAmount': bill.totalAmount,
                'paymentMethod': 'CASH',
                'paidAt': datetime.now()
            }
        )
        print("PAYMENT RECORDED.")

        parent_phone = input("Enter Parent Mobile for Receipt (e.g. 0300...): ")
        message = (
            f"Dear Parent, received {bill.totalAmount} PKR for "
            f"{bill.student.fullName}. Thank you. - SAIREX SCHOOL"
        )

        print("Dispatching to Veevo Tech...")
        send_sms_alert(parent_phone, message)
    
    else:
        print("Payment cancelled.")

    await prisma.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
    