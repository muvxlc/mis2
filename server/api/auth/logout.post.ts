export default defineEventHandler(async (event) => {
  deleteCookie(event, 'token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return { success: true };
});
