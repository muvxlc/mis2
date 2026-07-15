import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';
import { getExternalDb } from '../../utils/externalDb';
import { sql, eq, and } from 'drizzle-orm';
import { requireAuthenticatedUser } from '../../utils/authorization';

export default defineEventHandler(async (event) => {
  await requireAuthenticatedUser(event);
  try {
    // 1. ดึงการตั้งค่าฐานข้อมูลที่ Active ตัวแรก
    const [config] = await db.select()
      .from(externalDatabases)
      .where(and(
        eq(externalDatabases.isActive, 1),
        eq(externalDatabases.type, 'mysql')
      ))
      .limit(1);

    if (!config) {
      return { clinics: [], status: 'no_config' };
    }

    // 2. เชื่อมต่อ HOSxP
    const extDb = await getExternalDb({
      id: config.id,
      type: config.type as 'mysql' | 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database
    });

    // 3. Query นับจำนวนผู้รับบริการแยกตามห้องตรวจ (main_dep)
    // เชื่อมกับ kskdepartment เพื่อเอาชื่อห้องตรวจ
    const query = sql`
      SELECT 
        k.department as clinic_name, 
        COUNT(o.vn) as total 
      FROM ovst o
      LEFT JOIN kskdepartment k ON k.depcode = o.main_dep
      WHERE o.vstdate = CURRENT_DATE()
      GROUP BY o.main_dep, k.department
      ORDER BY total DESC
    `;

    const result = await extDb.execute(query);
    const rows = Array.isArray(result) ? result[0] : result;
    
    return { 
      clinics: rows as any[],
      status: 'success'
    };
  } catch (e: any) {
    console.error('Failed to query HOSxP Clinic Stats:', e.message);
    return { 
      clinics: [], 
      status: 'error', 
      message: e.message 
    };
  }
});
