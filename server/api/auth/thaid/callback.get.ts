import { db } from '../../../utils/db';
import { users, roles } from '../../../database/schema';
import { eq } from 'drizzle-orm';
import { exchangeThaIDCode, getThaIDUserInfo } from '../../../utils/thaid';
import { createToken } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Authorization code missing' });
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await exchangeThaIDCode(code);
    
    // 2. Get user info using access token
    const thaidUser = await getThaIDUserInfo(tokenResponse.access_token);
    
    // thaidUser should contain 'pid' and 'name' (or 'given_name'/'family_name' depending on ThaiID response)
    const pid = thaidUser.pid;
    const fullName = thaidUser.name;

    if (!pid) {
      throw createError({ statusCode: 400, statusMessage: 'PID not found in ThaiID response' });
    }

    // 3. Find or Create user in our database
    let user = (await db.select().from(users).where(eq(users.thaiId, pid)).limit(1))[0];

    if (!user) {
      // Get default 'user' role
      const userRole = (await db.select().from(roles).where(eq(roles.name, 'user')).limit(1))[0];
      
      const newUser = {
        username: `thaid_${pid}`,
        thaiId: pid,
        fullName: fullName || 'ThaiID User',
        roleId: userRole?.id || 4, // Default to user role if not found
      };

      const result = await db.insert(users).values(newUser);
      user = { id: result[0].insertId, ...newUser } as any;
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
      maxAge: 60 * 60 * 2, // 2 hours
      path: '/'
    });

    // 6. Redirect to dashboard
    return sendRedirect(event, '/');

  } catch (e: any) {
    console.error('ThaiID Login Error:', e);
    throw createError({ statusCode: 500, statusMessage: 'Login failed: ' + (e.message || 'Unknown error') });
  }
});
