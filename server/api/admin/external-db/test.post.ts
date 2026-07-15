import { testExternalConnection } from '../../../utils/externalDb';
import { requireAdmin } from '../../../utils/authorization';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = await readBody(event);
  
  if (!body.host || !body.username || !body.password || !body.database) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields for testing connection',
    });
  }

  try {
    // Handle cases where type might be sent as an object from the UI
    const dbType = typeof body.type === 'object' ? body.type.value : (body.type || 'mysql');
    const password = body.password || '';
    
    const success = await testExternalConnection({
      type: dbType,
      host: body.host,
      port: Number(body.port) || (dbType === 'postgres' ? 5432 : 3306),
      username: body.username,
      password: password,
      database: body.database,
    });
    return { success };
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Connection failed',
    });
  }
});
