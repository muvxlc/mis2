import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';
import { desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  // Check admin role (middleware should handle this, but double check is good)
  // For now assuming global middleware handles auth
  
  try {
    const list = await db.select().from(externalDatabases).orderBy(desc(externalDatabases.createdAt));
    
    // Don't send passwords back in full, or at least mask them
    return list.map(item => ({
      ...item,
      password: '••••••••'
    }));
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch external databases',
    });
  }
});
