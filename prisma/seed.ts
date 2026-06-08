import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL ?? 'admin@junkshop.local';
  const phone = process.env.SUPER_ADMIN_PHONE ?? '0900000000';
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'Admin@12345';

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.superAdmin.upsert({
    where: { email },
    update: {},
    create: { name: 'Super Admin', email, phone, passwordHash },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Super admin ready: ${admin.email} (password from SUPER_ADMIN_PASSWORD)`);

  // Optional demo entity ("Ko Bar Bu" example from the spec) — only if absent.
  const existing = await prisma.entity.findUnique({ where: { code: 'KBB' } });
  if (!existing) {
    const entity = await prisma.entity.create({
      data: {
        code: 'KBB',
        name: 'Ko Bar Bu',
        ownerName: 'Ko Bar Bu',
        description: 'Demo junk shop entity',
        phone1: '09111111111',
      },
    });
    await prisma.subUser.create({
      data: {
        entityId: entity.id,
        username: 'admin',
        name: 'Ko Bar Bu',
        passwordHash: await bcrypt.hash('Admin@12345', 10),
        isMain: true,
      },
    });
    await prisma.shop.createMany({
      data: [
        { entityId: entity.id, code: 'KBB-S1', name: 'Shop 1' },
        { entityId: entity.id, code: 'KBB-S2', name: 'Shop 2' },
      ],
    });
    // eslint-disable-next-line no-console
    console.log('✅ Demo entity "Ko Bar Bu" (code KBB) with 2 shops + main user "admin" created');
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
