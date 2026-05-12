import { db } from '../utils/db';
import { roles, users, agencies } from '../database/schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Seeding roles...');
  const roleNames = ['superadmin', 'admin', 'user'];
  for (const name of roleNames) {
    await db.insert(roles).values({ name, description: `${name} role` }).onDuplicateKeyUpdate({ set: { name } });
  }

  console.log('Seeding default agency...');
  await db.insert(agencies).values({
    name: 'Default Agency',
    description: 'Default organization'
  }).onDuplicateKeyUpdate({ set: { name: 'Default Agency' } });

  console.log('Seeding superadmin user...');
  const superadminRole = await db.query.roles.findFirst({
    where: (roles, { eq }) => eq(roles.name, 'superadmin'),
  });

  const defaultAgency = await db.query.agencies.findFirst({
    where: (agencies, { eq }) => eq(agencies.name, 'Default Agency'),
  });

  if (superadminRole && defaultAgency) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await db.insert(users).values({
      username: 'admin',
      passwordHash: hashedPassword,
      fullName: 'Super Admin',
      email: 'admin@example.com',
      roleId: superadminRole.id,
      agencyId: defaultAgency.id,
    }).onDuplicateKeyUpdate({
      set: {
        passwordHash: hashedPassword,
        fullName: 'Super Admin',
        email: 'admin@example.com',
        roleId: superadminRole.id,
        agencyId: defaultAgency.id,
      }
    });
  }

  console.log('Seeding completed!');
  console.log('Default credentials: username=admin, password=admin123');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
