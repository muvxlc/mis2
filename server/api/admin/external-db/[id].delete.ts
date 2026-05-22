import { db } from '../../../utils/db';
import { externalDatabases } from '../../../database/schema';
import { eq } from 'drizzle-orm';
import { closeExternalPool } from '../../../utils/externalDb';

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'));

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid ID',
    });
  }

  try {
    const [existing] = await db.select().from(externalDatabases).where(eq(externalDatabases.id, id));
    
    if (existing) {
      await closeExternalPool(id, existing.type as 'mysql' | 'postgres');
      await db.delete(externalDatabases).where(eq(externalDatabases.id, id));
    }

    return { success: true };
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete external database connection',
    });
  }
});
