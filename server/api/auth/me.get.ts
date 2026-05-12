import { verifyToken } from '../../utils/auth';
import { db } from '../../utils/db';
import { users, roles, agencies } from '../../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'token');
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || !payload.id) return null;

  const userList = await db.select({
    id: users.id,
    username: users.username,
    fullName: users.fullName,
    role: roles.name,
    agency: agencies.name,
  })
  .from(users)
  .leftJoin(roles, eq(users.roleId, roles.id))
  .leftJoin(agencies, eq(users.agencyId, agencies.id))
  .where(eq(users.id, Number(payload.id)))
  .limit(1);

  const user = userList[0];
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    agency: user.agency,
  };
});
