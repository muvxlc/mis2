import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  if (!body.name || !body.host || !body.username || !body.password || !body.database) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields',
    });
  }

  try {
    const result = await db.insert(externalDatabases).values({
      name: body.name,
      type: body.type || 'mysql',
      host: body.host,
      port: Number(body.port) || (body.type === 'postgres' ? 5432 : 3306),
      username: body.username,
      password: body.password,
      database: body.database,
      isActive: body.isActive !== undefined ? body.isActive : 1,
    });

    return { success: true, result };
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      statusMessage: e.message || 'Failed to create external database connection',
    });
  }
});
