import { db } from '../../utils/db';
import { users } from '../../database/schema';
import bcrypt from 'bcryptjs';
import { verifyToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'token');
  const payload = await verifyToken(token || '');
  
  if (!payload || (payload.role !== 'superadmin' && payload.role !== 'admin')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  const body = await readBody(event);
  console.log('[DEBUG] Create User Body:', body);
  const { username, password, fullName, roleId, agencyId, thaiId } = body;

  if (!username || (!password && !thaiId)) {
    throw createError({ statusCode: 400, statusMessage: 'Username and password/thaiId are required' });
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  try {
    const result = await db.insert(users).values({
      username,
      passwordHash,
      fullName,
      roleId: Number(roleId),
      agencyId: agencyId ? Number(agencyId) : null,
      thaiId
    });
    console.log('[DEBUG] Create User Success. ID:', result[0].insertId);
    return { id: result[0].insertId };
  } catch (err: any) {
    console.error('[DEBUG] Create User Error:', err);
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user: ' + err.message });
  }
});
