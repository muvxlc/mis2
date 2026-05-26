import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';
import { getExternalDb } from '../../utils/externalDb';
import { sql, eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
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
      return { 
        opd: 0, 
        ipd_ward: 0, 
        ipd_lr: 0, 
        status: 'no_config' 
      };
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

    // 3. Query ข้อมูล
    // OPD: นับ vn จาก ovst
    const opdQuery = sql`SELECT COUNT(vn) as total FROM ovst WHERE vstdate = CURRENT_DATE()`;
    
    // IPD WARD: นับ an ใน an_stat where ward = '11'
    const ipdWardQuery = sql`SELECT COUNT(an) as total FROM an_stat WHERE regdate = CURRENT_DATE() AND ward = '11'`;
    
    // IPD LR: นับ an ใน an_stat where ward = '12'
    const ipdLrQuery = sql`SELECT COUNT(an) as total FROM an_stat WHERE regdate = CURRENT_DATE() AND ward = '12'`;

    const [opdRes, ipdWardRes, ipdLrRes] = await Promise.all([
      extDb.execute(opdQuery),
      extDb.execute(ipdWardQuery),
      extDb.execute(ipdLrQuery)
    ]);

    const getCount = (res: any) => {
      const rows = Array.isArray(res) ? res[0] : res;
      return Number((rows as any)?.[0]?.total || 0);
    };

    return { 
      opd: getCount(opdRes),
      ipd_ward: getCount(ipdWardRes),
      ipd_lr: getCount(ipdLrRes),
      status: 'success',
      dbName: config.name 
    };
  } catch (e: any) {
    console.error('Failed to query HOSxP Stats:', e.message);
    return { 
      opd: 0, 
      ipd_ward: 0, 
      ipd_lr: 0, 
      status: 'error', 
      message: e.message 
    };
  }
});
