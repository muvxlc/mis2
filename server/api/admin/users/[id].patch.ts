import { db } from '../../../utils/db';
import { users } from '../../../database/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { verifyToken } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'token');
  const payload = await verifyToken(token || '');
  
  if (!payload || (payload.role !== 'superadmin' && payload.role !== 'admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  const id = Number(getRouterParam(event, 'id'));
  const body = await readBody(event);

  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' });

  const values: any = {
    username: body.username,
    fullName: body.fullName,
    roleId: Number(body.roleId),
    agencyId: body.agencyId ? Number(body.agencyId) : null,
    thaiId: body.thaiId
  };

  // Only update password if provided
  if (body.password) {
    values.passwordHash = await bcrypt.hash(body.password, 10);
  }

  await db.update(users).set(values).where(eq(users.id, id));

  return { success: true };
});
