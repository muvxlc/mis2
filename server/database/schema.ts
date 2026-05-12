import { mysqlTable, varchar, timestamp, int } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

export const roles = mysqlTable('roles', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(), // superadmin, admin, user
  description: varchar('description', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const agencies = mysqlTable('agencies', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: varchar('description', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  thaiId: varchar('thai_id', { length: 13 }).unique(),
  fullName: varchar('full_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  roleId: int('role_id').notNull().references(() => roles.id),
  agencyId: int('agency_id').references(() => agencies.id),
  isActive: int('is_active').default(1), // 1 = active, 0 = inactive
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').onUpdateNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  agency: one(agencies, { fields: [users.agencyId], references: [agencies.id] }),
}));
