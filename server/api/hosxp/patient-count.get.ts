import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';
import { getExternalDb } from '../../utils/externalDb';
import { sql, eq, and } from 'drizzle-orm';
import { requireAuthenticatedUser } from '../../utils/authorization';

export default defineEventHandler(async (event) => {
  await requireAuthenticatedUser(event);
  try {
    // 1. Find the first active HOSxP database config
    const [config] = await db.select()
      .from(externalDatabases)
      .where(and(
        eq(externalDatabases.isActive, 1),
        eq(externalDatabases.type, 'mysql') // HOSxP is usually MySQL/MariaDB
      ))
      .limit(1);

    if (!config) {
      return { count: 0, status: 'no_config' };
    }

    // 2. Get connection to the external DB
    const extDb = await getExternalDb({
      id: config.id,
      type: config.type as 'mysql' | 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database
    });

    // 3. Execute the HOSxP query
    // select count(vn) from ovst where vstdate = current_date()
    const result = await extDb.execute(sql`SELECT COUNT(vn) as total FROM ovst WHERE vstdate = CURRENT_DATE()`);
    
    // mysql2 returns [rows, fields]
    const rows = Array.isArray(result) ? result[0] : result;
    const count = (rows as any)?.[0]?.total || 0;

    return { 
      count: Number(count), 
      status: 'success',
      dbName: config.name 
    };
  } catch (e: any) {
    console.error('Failed to query HOSxP:', e.message);
    return { 
      count: 0, 
      status: 'error', 
      message: e.message 
    };
  }
});
