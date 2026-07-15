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
    const existingAdmin = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, 'admin'),
    });

    if (!existingAdmin) {
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword || adminPassword.length < 12 || adminPassword.startsWith('replace-with-')) {
        throw new Error('ADMIN_PASSWORD must be set to at least 12 characters when creating the initial admin');
      }

      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      await db.insert(users).values({
        username: 'admin',
        passwordHash: hashedPassword,
        fullName: 'Super Admin',
        email: 'admin@example.com',
        roleId: superadminRole.id,
        agencyId: defaultAgency.id,
      });
    }
  }

  console.log('Seeding completed!');
  console.log('Initial admin account is ready.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
