import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';
import { getExternalDb } from '../../utils/externalDb';
import { sql, eq, and } from 'drizzle-orm';

// In-Memory Server Cache to optimize and protect the HOSxP database
interface CacheEntry {
  visits: any[];
  expiresAt: number;
}
const rawVisitsCache = new Map<string, CacheEntry>();

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const startDate = query.startDate as string || new Date().toISOString().split('T')[0];
  const endDate = query.endDate as string || new Date().toISOString().split('T')[0];
  const startTime = query.startTime as string || '08:00:00';
  const endTime = query.endTime as string || '16:00:59';
  const vn = query.vn as string || '';
  const bypassCache = query.bypassCache === 'true';

  const cacheKey = `${startDate}_${endDate}_${startTime}_${endTime}`;
  const now = Date.now();

  // 1. Check Server-Side Cache (Only if NOT querying a specific VN and NOT bypassing cache)
  if (!vn && !bypassCache && rawVisitsCache.has(cacheKey)) {
    const cached = rawVisitsCache.get(cacheKey)!;
    if (now < cached.expiresAt) {
      console.log(`[Waiting-Time-API] Serving cached raw visits for key: ${cacheKey}`);
      return { visits: cached.visits, cached: true, status: 'success' };
    } else {
      rawVisitsCache.delete(cacheKey);
    }
  }

  const dateTimeStart = `${startDate} ${startTime}`;
  const dateTimeEnd = `${endDate} ${endTime}`;

  try {
    // 2. Fetch HOSxP Connection Config
    const [config] = await db.select()
      .from(externalDatabases)
      .where(and(
        eq(externalDatabases.isActive, 1),
        eq(externalDatabases.type, 'mysql')
      ))
      .limit(1);

    if (!config) {
      return { visits: [], status: 'no_config', message: 'No external HOSxP database configured' };
    }

    // 3. Connect to HOSxP Database
    const extDb = await getExternalDb({
      id: config.id,
      type: config.type as 'mysql' | 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database
    });

    // 4. Query Raw Patient Visits with calculated time segments and filter flags
    if (vn) {
      console.log(`[Waiting-Time-API] Querying HOSxP database for specific VN: ${vn}`);
    } else {
      console.log(`[Waiting-Time-API] Querying HOSxP database for raw visits: ${startDate} to ${endDate} (${startTime} to ${endTime})`);
    }

    const innerWhere = vn 
      ? sql`o.vn = ${vn}`
      : sql`CONCAT(o.vstdate, ' ', o.vsttime) BETWEEN ${dateTimeStart} AND ${dateTimeEnd} 
          AND o.main_dep = '010'
          AND o.spclty = '01'
          AND o.vsttime BETWEEN ${startTime} AND ${endTime}`;

    const [visits]: any[] = await extDb.execute(sql`
      SELECT 
        o.vn,
        o.hn,
        o.vstdate,
        o.vsttime,
        o.departmentname,
        HOUR(o.vsttime) AS visit_hour,
        
        -- [สถิติรายบุคคล (หน่วยนาที)]
        TIMESTAMPDIFF(MINUTE, t1.service_end_datetime, t2.service_begin_datetime) AS wait_screen_m,
        ROUND(t2.service_time_second / 60, 2) AS screen_m,
        TIMESTAMPDIFF(MINUTE, t2.service_end_datetime, t3.service_begin_datetime) AS wait_doctor_m,
        ROUND(t3.service_time_second / 60, 2) AS doctor_m,
        TIMESTAMPDIFF(MINUTE, t3.service_end_datetime, rx.rx_dispenser_datetime) AS wait_drug_m,
        
        -- [วันเวลาดิบสำหรับการเจาะลึก Timeline]
        DATE_FORMAT(t1.service_end_datetime, '%Y-%m-%d %H:%i:%s') AS reg_end_dt,
        DATE_FORMAT(t2.service_begin_datetime, '%Y-%m-%d %H:%i:%s') AS screen_begin_dt,
        DATE_FORMAT(t2.service_end_datetime, '%Y-%m-%d %H:%i:%s') AS screen_end_dt,
        DATE_FORMAT(t3.service_begin_datetime, '%Y-%m-%d %H:%i:%s') AS doc_begin_dt,
        DATE_FORMAT(t3.service_end_datetime, '%Y-%m-%d %H:%i:%s') AS doc_end_dt,
        DATE_FORMAT(rx.rx_dispenser_datetime, '%Y-%m-%d %H:%i:%s') AS rx_dispense_dt,
        
        -- [Flags คัดกรองสำหรับนำไปคำนวณสดฝั่งไคลเอนต์]
        IF(DAYOFWEEK(o.vstdate) IN (1, 7), 1, 0) AS is_weekend,
        IF(EXISTS(SELECT 1 FROM oapp oa WHERE oa.visit_vn = o.vn AND oa.nextdate = o.vstdate), 1, 0) AS is_appointed,
        IF(EXISTS(SELECT 1 FROM lab_head lh WHERE lh.vn = o.vn), 1, 0) AS has_lab,
        IF(EXISTS(SELECT 1 FROM xray_head xh WHERE xh.vn = o.vn), 1, 0) AS has_xray,
        IF(EXISTS(
          SELECT 1 FROM vn_stat vs 
          WHERE vs.vn = o.vn 
            AND (
              (vs.op0 IS NOT NULL AND vs.op0 <> '') OR
              (vs.op1 IS NOT NULL AND vs.op1 <> '') OR
              (vs.op2 IS NOT NULL AND vs.op2 <> '') OR
              (vs.op3 IS NOT NULL AND vs.op3 <> '') OR
              (vs.op4 IS NOT NULL AND vs.op4 <> '') OR
              (vs.op5 IS NOT NULL AND vs.op5 <> '')
            )
        ), 1, 0) AS has_procedure
      FROM (
        SELECT 
          o.vn, 
          o.hn,
          o.vstdate,
          o.vsttime,
          s.department AS departmentname
        FROM ovst o
        JOIN kskdepartment s ON o.main_dep = s.depcode
        WHERE ${innerWhere}
      ) o
      JOIN (
        SELECT vn, MIN(service_end_datetime) AS service_end_datetime
        FROM ovst_service_time
        WHERE ovst_service_time_type_code = 'OPD-NEW-VISIT'
        GROUP BY vn
      ) t1 ON t1.vn = o.vn
      JOIN (
        SELECT s1.vn, s1.service_begin_datetime, s1.service_end_datetime, s1.service_time_second
        FROM ovst_service_time s1
        INNER JOIN (
          SELECT vn, MIN(service_begin_datetime) AS min_begin
          FROM ovst_service_time
          WHERE ovst_service_time_type_code = 'OPD-SCREEN'
          GROUP BY vn
        ) s2 ON s1.vn = s2.vn AND s1.service_begin_datetime = s2.min_begin
        WHERE s1.ovst_service_time_type_code = 'OPD-SCREEN'
      ) t2 ON t2.vn = o.vn
      LEFT JOIN (
        SELECT s1.vn, s1.service_begin_datetime, s1.service_end_datetime, s1.service_time_second
        FROM ovst_service_time s1
        INNER JOIN (
          SELECT vn, MIN(service_begin_datetime) AS min_begin
          FROM ovst_service_time
          WHERE ovst_service_time_type_code = 'OPD-DOCTOR'
          GROUP BY vn
        ) s2 ON s1.vn = s2.vn AND s1.service_begin_datetime = s2.min_begin
        WHERE s1.ovst_service_time_type_code = 'OPD-DOCTOR'
      ) t3 ON t3.vn = o.vn AND t3.service_begin_datetime >= t2.service_end_datetime
      LEFT JOIN (
        SELECT vn, MAX(rx_dispenser_datetime) AS rx_dispenser_datetime
        FROM rx_dispenser_detail
        WHERE rx_dispenser_type_id = '4' AND confirm_substock_transaction = 'Y'
        GROUP BY vn
      ) rx ON rx.vn = o.vn AND rx.rx_dispenser_datetime >= t3.service_end_datetime
      WHERE t2.service_begin_datetime >= t1.service_end_datetime
    `);

    const resultVisits = visits || [];

    // ดึงลายเซ็นแพทย์ลงประวัติผู้ป่วยนอก (Doctor Signatures) หากเป็นเคสรายเดี่ยว
    let doctorSigns: any[] = [];
    if (vn) {
      console.log(`[Waiting-Time-API] Querying doctor signatures for VN: ${vn}`);
      const [signs]: any[] = await extDb.execute(sql`
        SELECT 
          d.name AS doctor_name, 
          k.department AS department_name, 
          DATE_FORMAT(ds.sign_datetime, '%Y-%m-%d %H:%i:%s') AS sign_datetime 
        FROM ovst_doctor_sign ds
        LEFT OUTER JOIN doctor d ON ds.doctor = d.code
        LEFT OUTER JOIN kskdepartment k ON ds.depcode = k.depcode
        WHERE ds.vn = ${vn}
        ORDER BY ds.sign_datetime ASC
      `);
      doctorSigns = signs || [];
    }

    // 5. Store in Cache with smart expiration (Only if NOT querying a specific VN)
    if (!vn) {
      const todayStr = new Date().toISOString().split('T')[0];
      const isToday = endDate >= todayStr;
      const ttlMs = isToday ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000;

      rawVisitsCache.set(cacheKey, {
        visits: resultVisits,
        expiresAt: now + ttlMs
      });
    }

    return {
      visits: resultVisits,
      doctorSigns,
      cached: false,
      status: 'success'
    };

  } catch (err: any) {
    console.error('Waiting Time API Error:', err);
    return { visits: [], status: 'error', message: err.message };
  }
});
