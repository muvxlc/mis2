import { db } from '../../../utils/db';
import { users } from '../../../database/schema';
import { eq } from 'drizzle-orm';
import { verifyToken } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'token');
  const payload = await verifyToken(token || '');
  
  if (!payload || (payload.role !== 'superadmin' && payload.role !== 'admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  const id = Number(getRouterParam(event, 'id'));
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' });

  // Prevent self-deletion
  if (id === Number(payload.id)) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete yourself' });
  }

  await db.delete(users).where(eq(users.id, id));

  return { success: true };
});
