import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';
import { desc } from 'drizzle-orm';
import { requireAdmin } from '../../utils/authorization';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  
  try {
    const list = await db.select().from(externalDatabases).orderBy(desc(externalDatabases.createdAt));
    
    // Don't send passwords back in full, or at least mask them
    return list.map(item => ({
      ...item,
      password: '••••••••'
    }));
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch external databases',
    });
  }
});
