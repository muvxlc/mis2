import { db } from '../../../utils/db';
import { users, roles } from '../../../database/schema';
import { eq } from 'drizzle-orm';
import { exchangeThaIDCode, getThaIDUserInfo } from '../../../utils/thaid';
import { createToken } from '../../../utils/auth';
import { timingSafeEqual } from 'node:crypto';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const receivedState = typeof query.state === 'string' ? query.state : '';
  const expectedState = getCookie(event, 'thaid_oauth_state') || '';

  if (!code || !receivedState || !expectedState) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth callback' });
  }

  const receivedStateBuffer = Buffer.from(receivedState);
  const expectedStateBuffer = Buffer.from(expectedState);
  if (
    receivedStateBuffer.length !== expectedStateBuffer.length ||
    !timingSafeEqual(receivedStateBuffer, expectedStateBuffer)
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid OAuth state' });
  }

  deleteCookie(event, 'thaid_oauth_state', { path: '/' });

  try {
    // 1. Exchange code for access token
    const tokenResponse = await exchangeThaIDCode(code);
    
    // 2. Get user info using access token
    const thaidUser = await getThaIDUserInfo(tokenResponse.access_token);
    
    // thaidUser should contain 'pid' and 'name' (or 'given_name'/'family_name' depending on ThaiID response)
    const pid = thaidUser.pid;
    const fullName = thaidUser.name;

    if (typeof pid !== 'string' || !/^\d{13}$/.test(pid)) {
      throw createError({ statusCode: 400, statusMessage: 'PID not found in ThaiID response' });
    }

    // 3. Find or Create user in our database
    let user = (await db.select().from(users).where(eq(users.thaiId, pid)).limit(1))[0];

    if (!user) {
      // Get default 'user' role
      const userRole = (await db.select().from(roles).where(eq(roles.name, 'user')).limit(1))[0];
      
      if (!userRole) {
        throw new Error('Default user role is not configured');
      }

      const newUser = {
        username: `thaid_${pid}`,
        thaiId: pid,
        fullName: fullName || 'ThaiID User',
        roleId: userRole.id,
      };

      await db.insert(users).values(newUser);
      user = (await db.select().from(users).where(eq(users.thaiId, pid)).limit(1))[0];
      if (!user) {
        throw new Error('Failed to create ThaiID user');
      }
    }

    if (user.isActive === 0) {
      throw createError({ statusCode: 403, statusMessage: 'User account is inactive' });
    }

    // 4. Create JWT Token
    const token = await createToken({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: (await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1))[0]?.name || 'user',
      agencyId: user.agencyId
    });

    // 5. Set Cookie
    setCookie(event, 'token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 2, // 2 hours
      path: '/'
    });

    // 6. Redirect to dashboard
    return sendRedirect(event, '/');

  } catch {
    throw createError({ statusCode: 500, statusMessage: 'ThaiID login failed' });
  }
});
