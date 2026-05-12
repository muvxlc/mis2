import { db } from '../../utils/db';
import { users, roles, agencies } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';
import { verifyToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'token');
  const payload = await verifyToken(token || '');
  
  if (!payload || (payload.role !== 'superadmin' && payload.role !== 'admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  return await db.select({
    id: users.id,
    username: users.username,
    fullName: users.fullName,
    thaiId: users.thaiId,
    role: roles.name,
    roleId: users.roleId,
    agency: agencies.name,
    agencyId: users.agencyId,
    createdAt: users.createdAt,
  })
  .from(users)
  .leftJoin(roles, eq(users.roleId, roles.id))
  .leftJoin(agencies, eq(users.agencyId, agencies.id))
  .orderBy(desc(users.createdAt));
});
