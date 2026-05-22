import { db } from '../../../utils/db';
import { externalDatabases } from '../../../database/schema';
import { eq } from 'drizzle-orm';
import { closeExternalPool } from '../../../utils/externalDb';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));
  const body = await readBody(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid ID',
    });
  }

  try {
    // Get current config to know the type for closing pool
    const [existing] = await db.select().from(externalDatabases).where(eq(externalDatabases.id, id));
    
    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Connection not found',
      });
    }

    // Close existing pool before updating (to force recreation with new settings)
    await closeExternalPool(id, existing.type as 'mysql' | 'postgres');

    const updateData: any = {
      name: body.name,
      type: body.type,
      host: body.host,
      port: body.port !== undefined ? Number(body.port) : undefined,
      username: body.username,
      database: body.database,
      isActive: body.isActive !== undefined ? body.isActive : undefined,
    };

    // Only update password if provided and not the masked version
    if (body.password && body.password !== '••••••••') {
      updateData.password = body.password;
    }

    await db.update(externalDatabases)
      .set(updateData)
      .where(eq(externalDatabases.id, id));

    return { success: true };
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      statusMessage: e.message || 'Failed to update external database connection',
    });
  }
});
