import type { H3Event } from 'h3';
import { createError, getCookie } from 'h3';
import { verifyToken } from './auth';

export async function requireAuthenticatedUser(event: H3Event) {
  const token = getCookie(event, 'token');
  const payload = token ? await verifyToken(token) : null;

  if (!payload?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' });
  }

  return payload;
}

export async function requireAdmin(event: H3Event) {
  const payload = await requireAuthenticatedUser(event);

  if (payload.role !== 'superadmin' && payload.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' });
  }

  return payload;
}
