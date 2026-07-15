import { getThaIDAuthUrl } from '../../../utils/thaid';
import { randomBytes } from 'node:crypto';

export default defineEventHandler((event) => {
  const state = randomBytes(32).toString('base64url');
  setCookie(event, 'thaid_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  });

  const url = getThaIDAuthUrl(state);
  return sendRedirect(event, url);
});
