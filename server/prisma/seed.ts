import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@ipo.local';
  const staffEmail = 'staff@ipo.local';

  const passwordHash = await bcrypt.hash('Pass@123', 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      fullName: 'System Admin',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: staffEmail },
    update: {},
    create: {
      fullName: 'Data Entry Staff',
      email: staffEmail,
      passwordHash,
      role: 'STAFF',
      isActive: true,
    },
  });

  console.log('Seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
