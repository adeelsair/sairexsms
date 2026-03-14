const { PrismaClient } = require('/app/web/lib/generated/prisma');
const prisma = new PrismaClient();

(async () => {
  const grouped = await prisma.organization.groupBy({
    by: ['mode'],
    _count: { _all: true },
  });
  console.log(JSON.stringify(grouped));
})().catch((e) => {
  console.error('ERR', e && e.message ? e.message : e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
