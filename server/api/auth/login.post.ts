import bcrypt from 'bcryptjs';
import { db } from '../../utils/db';
import { users, roles } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { createToken } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { username, password } = body;

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username and password are required',
    });
  }

  const userList = await db.select({
    id: users.id,
    username: users.username,
    passwordHash: users.passwordHash,
    fullName: users.fullName,
    role: roles.name,
    agencyId: users.agencyId,
  })
  .from(users)
  .leftJoin(roles, eq(users.roleId, roles.id))
  .where(eq(users.username, username))
  .limit(1);

  const user = userList[0];

  if (!user || !user.passwordHash) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials',
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials',
    });
  }

  const token = await createToken({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    agencyId: user.agencyId,
  });

  setCookie(event, 'token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 2, // 2 hours
    path: '/',
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    },
  };
});
