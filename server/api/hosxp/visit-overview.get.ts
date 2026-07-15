import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';
import { getExternalDb } from '../../utils/externalDb';
import { sql, eq, and } from 'drizzle-orm';
import { requireAuthenticatedUser } from '../../utils/authorization';

export default defineEventHandler(async (event) => {
  await requireAuthenticatedUser(event);
  try {
    // 1. ดึงค่าเดือนและปีปัจจุบัน
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // 2. ดึงการตั้งค่าฐานข้อมูลที่ Active ตัวแรก (สมมติว่าเป็น Slave หลักสำหรับ Dashboard)
    const [config] = await db.select()
      .from(externalDatabases)
      .where(and(
        eq(externalDatabases.isActive, 1),
        eq(externalDatabases.type, 'mysql')
      ))
      .limit(1);

    if (!config) {
      return { data: [], status: 'no_config' };
    }

    // 3. เชื่อมต่อ HOSxP
    const extDb = await getExternalDb({
      id: config.id,
      type: config.type as 'mysql' | 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database
    });

    // 4. Query นับจำนวน VN รายวันในเดือนปัจจุบัน
    // ดึงเฉพาะวัน (DAY) และยอดรวม
    const query = sql`
      SELECT 
        DAY(vstdate) as day, 
        COUNT(vn) as count 
      FROM ovst 
      WHERE MONTH(vstdate) = ${currentMonth} 
        AND YEAR(vstdate) = ${currentYear}
      GROUP BY DAY(vstdate)
      ORDER BY day ASC
    `;

    const result = await extDb.execute(query);
    const rows = Array.isArray(result) ? result[0] : result;
    
    // 5. จัดการข้อมูลให้ครบทุกวันในเดือนนั้นๆ (Fill missing days with 0)
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const dailyData = [];
    
    // แปลงผลลัพธ์เป็น Map เพื่อให้ค้นหาง่าย
    const resultMap = new Map();
    if (Array.isArray(rows)) {
      rows.forEach((row: any) => {
        resultMap.set(Number(row.day), Number(row.count));
      });
    }

    for (let d = 1; d <= lastDay; d++) {
      dailyData.push({
        day: d,
        count: resultMap.get(d) || 0
      });
    }

    return { 
      data: dailyData,
      month: currentMonth,
      year: currentYear,
      status: 'success',
      dbName: config.name 
    };
  } catch (e: any) {
    console.error('Failed to query HOSxP Visit Overview:', e.message);
    return { 
      data: [], 
      status: 'error', 
      message: e.message 
    };
  }
});
