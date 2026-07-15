import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is not set');
}
if (
  jwtSecret.length < 32 ||
  (process.env.NODE_ENV === 'production' &&
    (jwtSecret.includes('change-in-production') || jwtSecret.startsWith('replace-with-')))
) {
  throw new Error('JWT_SECRET must be at least 32 characters and must not use the example value');
}

const secret = new TextEncoder().encode(jwtSecret);

export const createToken = async (payload: JWTPayload) => {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret);
};

export const verifyToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
};
