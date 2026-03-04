import { db } from './lib/db'

async function test() {
  try {
    // This just attempts to connect and run a simple query
    await db.$connect()
    console.log("✅ Database connection successful!")
    
    // Optional: count users to see if data exists
    // const userCount = await db.user.count()
    // console.log(`Current user count: ${userCount}`)
    
  } catch (error) {
    console.error("❌ Database connection failed:", error)
  } finally {
    await db.$disconnect()
  }
}

test()