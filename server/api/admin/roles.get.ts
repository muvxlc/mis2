import { db } from '../../utils/db';
import { roles } from '../../database/schema';
import { verifyToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'token');
  const payload = await verifyToken(token || '');
  
  console.log('[DEBUG] Roles API Payload:', payload);

  if (!payload || (payload.role !== 'superadmin' && payload.role !== 'admin')) {
    console.log('[DEBUG] Roles API Access Denied. Role:', payload?.role);
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  return await db.select().from(roles);
});
