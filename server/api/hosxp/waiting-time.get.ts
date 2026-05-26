import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';
import { getExternalDb } from '../../utils/externalDb';
import { sql, eq, and } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const startDate = query.startDate as string || new Date().toISOString().split('T')[0];
  const endDate = query.endDate as string || new Date().toISOString().split('T')[0];

  // ดึงค่า Dynamic Filters จากฝั่งหน้าบ้าน (รับค่าเป็น string 'true' / 'false')
  const excludeWeekends = query.excludeWeekends === 'true';
  const excludeAppointed = query.excludeAppointed === 'true';
  const excludeLab = query.excludeLab === 'true';
  const excludeXray = query.excludeXray === 'true';
  const excludeEmptyCC = query.excludeEmptyCC === 'true';
  const requireMedication = query.requireMedication === 'true';

  const dateTimeStart = `${startDate} 08:00:00`;
  const dateTimeEnd = `${endDate} 16:00:00`;

  try {
    // 1. ดึงการตั้งค่าฐานข้อมูล HOSxP
    const [config] = await db.select()
      .from(externalDatabases)
      .where(and(
        eq(externalDatabases.isActive, 1),
        eq(externalDatabases.type, 'mysql')
      ))
      .limit(1);

    if (!config) {
      return { stats: null, metadata: { startDate, endDate }, status: 'no_config' };
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

    // 3. ประกอบเงื่อนไขฟิลเตอร์ Dynamic WHERE
    // สำหรับ Query หลัก (ใช้ Alias 'o' สำหรับ Subquery และ 'os' สำหรับ opdscreen)
    let filterConditions = '';
    if (excludeWeekends) {
      filterConditions += ` AND DAYOFWEEK(o.vstdate) NOT IN (1, 7)`;
    }
    if (excludeEmptyCC) {
      filterConditions += ` AND os.cc IS NOT NULL AND os.cc <> ''`;
    }
    if (requireMedication) {
      filterConditions += ` AND EXISTS (SELECT 1 FROM opitemrece op WHERE op.vn = o.vn AND op.icode LIKE '1%')`;
    }
    if (excludeAppointed) {
      filterConditions += ` AND NOT EXISTS (SELECT 1 FROM oapp oa WHERE oa.visit_vn = o.vn AND oa.nextdate = o.vstdate)`;
    }
    if (excludeLab) {
      filterConditions += ` AND NOT EXISTS (SELECT 1 FROM lab_head lh WHERE lh.vn = o.vn)`;
    }
    if (excludeXray) {
      filterConditions += ` AND NOT EXISTS (SELECT 1 FROM xray_head xh WHERE xh.vn = o.vn)`;
    }

    // สำหรับ Queries ย่อย (ใช้ Alias 'ov' สำหรับ ovst และ 'os' สำหรับ opdscreen)
    let subFilters = '';
    if (excludeWeekends) {
      subFilters += ` AND DAYOFWEEK(ov.vstdate) NOT IN (1, 7)`;
    }
    if (excludeEmptyCC) {
      subFilters += ` AND os.cc IS NOT NULL AND os.cc <> ''`;
    }
    if (requireMedication) {
      subFilters += ` AND EXISTS (SELECT 1 FROM opitemrece op WHERE op.vn = ov.vn AND op.icode LIKE '1%')`;
    }
    if (excludeAppointed) {
      subFilters += ` AND NOT EXISTS (SELECT 1 FROM oapp oa WHERE oa.visit_vn = ov.vn AND oa.nextdate = ov.vstdate)`;
    }
    if (excludeLab) {
      subFilters += ` AND NOT EXISTS (SELECT 1 FROM lab_head lh WHERE lh.vn = ov.vn)`;
    }
    if (excludeXray) {
      subFilters += ` AND NOT EXISTS (SELECT 1 FROM xray_head xh WHERE xh.vn = ov.vn)`;
    }

    // 4. รัน Query หลัก (ปรับสูตรการคำนวณปัดเศษและคำนวณ Dynamic ใน Subquery ชั้นในเพื่อความเร็วสูงสุด)
    const [rawStats]: any[] = await extDb.execute(sql`
      SELECT 
        departmentname,
        COUNT(DISTINCT o.vstdate) AS day_cc,
        COUNT(DISTINCT o.vn) AS visit_cc,
        
        -- [ส่วนที่ 1: ซักประวัติ]
        ROUND(
            (SUM(TIMESTAMPDIFF(MINUTE, t1.service_end_datetime, t2.service_begin_datetime)) / COUNT(DISTINCT o.vstdate)) 
            / AVG(TIMESTAMPDIFF(MINUTE, t1.service_end_datetime, t2.service_begin_datetime)) 
        , 0) AS wait_screen_cc,
        ROUND(AVG(t2.service_time_second / 60), 0) AS screen_cc,
        
        -- [ส่วนที่ 2: พบแพทย์]
        ROUND(
            (SUM(IFNULL(TIMESTAMPDIFF(MINUTE, t2.service_end_datetime, t3.service_begin_datetime), 0)) / COUNT(DISTINCT o.vstdate)) 
            / AVG(IFNULL(TIMESTAMPDIFF(MINUTE, t2.service_end_datetime, t3.service_begin_datetime), NULL)) 
        , 0) AS wait_doctor,
        ROUND(AVG(IFNULL(t3.service_time_second / 60, NULL)), 0) AS doctor_cc,

        -- [ส่วนที่ 3: รับยา]
        ROUND(
            (SUM(IFNULL(TIMESTAMPDIFF(MINUTE, t3.service_end_datetime, rx.rx_dispenser_datetime), 0)) / COUNT(DISTINCT o.vstdate)) 
            / AVG(IFNULL(TIMESTAMPDIFF(MINUTE, t3.service_end_datetime, rx.rx_dispenser_datetime), NULL)) 
        , 0) AS wait_drug_cc,

        -- [ส่วนรวม]
        (
          ROUND((SUM(TIMESTAMPDIFF(MINUTE, t1.service_end_datetime, t2.service_begin_datetime)) / COUNT(DISTINCT o.vstdate)) / AVG(TIMESTAMPDIFF(MINUTE, t1.service_end_datetime, t2.service_begin_datetime)), 0) +
          ROUND(AVG(t2.service_time_second / 60), 0) +
          ROUND((SUM(IFNULL(TIMESTAMPDIFF(MINUTE, t2.service_end_datetime, t3.service_begin_datetime), 0)) / COUNT(DISTINCT o.vstdate)) / AVG(IFNULL(TIMESTAMPDIFF(MINUTE, t2.service_end_datetime, t3.service_begin_datetime), NULL)), 0) +
          ROUND(AVG(IFNULL(t3.service_time_second / 60, NULL)), 0) +
          ROUND((SUM(IFNULL(TIMESTAMPDIFF(MINUTE, t3.service_end_datetime, rx.rx_dispenser_datetime), 0)) / COUNT(DISTINCT o.vstdate)) / AVG(IFNULL(TIMESTAMPDIFF(MINUTE, t3.service_end_datetime, rx.rx_dispenser_datetime), NULL)), 0)
        ) AS total_wait,
        
        -- ป้องกันการหารศูนย์หรือ Error ให้เคส Range Min/Max
        MIN(TIMESTAMPDIFF(MINUTE, t1.service_end_datetime, t2.service_begin_datetime) + (t2.service_time_second / 60) + IFNULL(TIMESTAMPDIFF(MINUTE, t2.service_end_datetime, t3.service_begin_datetime), 0) + IFNULL(t3.service_time_second / 60, 0) + IFNULL(TIMESTAMPDIFF(MINUTE, t3.service_end_datetime, rx.rx_dispenser_datetime), 0)) AS m_min_total,
        MAX(TIMESTAMPDIFF(MINUTE, t1.service_end_datetime, t2.service_begin_datetime) + (t2.service_time_second / 60) + IFNULL(TIMESTAMPDIFF(MINUTE, t2.service_end_datetime, t3.service_begin_datetime), 0) + IFNULL(t3.service_time_second / 60, 0) + IFNULL(TIMESTAMPDIFF(MINUTE, t3.service_end_datetime, rx.rx_dispenser_datetime), 0)) AS m_max_total

      FROM (
        SELECT 
          o.vn, 
          o.vstdate,
          s.department AS departmentname
        FROM ovst o
        JOIN kskdepartment s ON o.main_dep = s.depcode
        LEFT JOIN opdscreen os ON os.vn = o.vn
        WHERE CONCAT(o.vstdate, ' ', o.vsttime) BETWEEN ${dateTimeStart} AND ${dateTimeEnd} 
          AND o.main_dep = '010'
          AND o.spclty = '01'
          AND o.vsttime BETWEEN '08:00:00' AND '16:00:00'
          ${sql.raw(filterConditions)}
      ) o
      JOIN 
        ovst_service_time t1 ON t1.vn = o.vn AND t1.ovst_service_time_type_code = 'OPD-NEW-VISIT'
      JOIN 
        ovst_service_time t2 ON t2.vn = o.vn AND t2.ovst_service_time_type_code = 'OPD-SCREEN'
      LEFT JOIN 
        ovst_service_time t3 ON t3.vn = o.vn AND t3.ovst_service_time_type_code = 'OPD-DOCTOR' 
        AND t3.service_begin_datetime >= t2.service_end_datetime
      LEFT JOIN
        rx_dispenser_detail rx ON rx.vn = o.vn AND rx.rx_dispenser_type_id='4' AND rx.confirm_substock_transaction = 'Y'
        AND rx.rx_dispenser_datetime >= t3.service_end_datetime
      WHERE t2.service_begin_datetime >= t1.service_end_datetime
      GROUP BY departmentname 
    `);

    if (!rawStats || rawStats.length === 0) {
      return { stats: null, metadata: { startDate, endDate }, status: 'success' };
    }

    const row = rawStats[0];

    // 5. Hourly Breakdown: รอซักประวัติ (กรอง Dynamic ตามสไตล์ฟิลเตอร์เพื่อความตรงกัน 100% ของตัวเลขกราฟ)
    const [hourlyScreen]: any[] = await extDb.execute(sql`
      SELECT 
          visit_hour,
          COUNT(ov.vn) AS patient_count,
          ROUND(AVG(NULLIF(wait_screen_seconds, 0)) / 60, 2) AS avg_wait_minutes,
          ROUND(MAX(NULLIF(wait_screen_seconds, 0)) / 60, 2) AS max_wait_minutes
      FROM (
          SELECT 
              ov.vn,
              HOUR(ov.vsttime) AS visit_hour,
              TIMESTAMPDIFF(SECOND, 
                  COALESCE(
                      (SELECT MIN(service_begin_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code LIKE 'OPD-NEW-VISIT%'),
                      CONCAT(ov.vstdate, ' ', ov.vsttime)
                  ), 
                  (SELECT MIN(service_begin_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-SCREEN')
              ) AS wait_screen_seconds
          FROM ovst ov
          LEFT JOIN opdscreen os ON os.vn = ov.vn
          WHERE ov.vstdate BETWEEN ${startDate} AND ${endDate}
          AND ov.main_dep = '010'
          AND ov.vsttime BETWEEN '08:00:00' AND '16:59:59'
          ${sql.raw(subFilters)}
      ) AS base_data
      WHERE wait_screen_seconds >= 0 AND wait_screen_seconds < 28800
      GROUP BY visit_hour
      HAVING patient_count > 0
      ORDER BY visit_hour
    `);

    // 6. Hourly Breakdown: รอตรวจ (Wait Doctor)
    const [hourlyDoctor]: any[] = await extDb.execute(sql`
      SELECT 
          visit_hour,
          COUNT(ov.vn) AS patient_count,
          ROUND(AVG(NULLIF(wait_doctor_seconds, 0)) / 60, 2) AS avg_wait_minutes,
          ROUND(MAX(NULLIF(wait_doctor_seconds, 0)) / 60, 2) AS max_wait_minutes
      FROM (
          SELECT 
              ov.vn,
              HOUR(ov.vsttime) AS visit_hour,
              TIMESTAMPDIFF(SECOND, 
                  COALESCE(
                      (SELECT MIN(service_end_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code LIKE 'OPD-SCREEN'),
                      CONCAT(ov.vstdate, ' ', ov.vsttime)
                  ), 
                  (SELECT MIN(service_begin_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-DOCTOR')
              ) AS wait_doctor_seconds
          FROM ovst ov
          LEFT JOIN opdscreen os ON os.vn = ov.vn
          WHERE ov.vstdate BETWEEN ${startDate} AND ${endDate}
          AND ov.main_dep = '010'
          AND ov.vsttime BETWEEN '08:00:00' AND '16:59:59'
          ${sql.raw(subFilters)}
      ) AS base_data
      WHERE wait_doctor_seconds >= 0 AND wait_doctor_seconds < 28800
      GROUP BY visit_hour
      HAVING patient_count > 0
      ORDER BY visit_hour
    `);

    // 7. Visit Traffic for OPD 7 (010)
    const [traffic]: any[] = await extDb.execute(sql`
      SELECT 
          HOUR(ov.vsttime) as hour, 
          COUNT(ov.vn) as total 
      FROM ovst ov
      LEFT JOIN opdscreen os ON os.vn = ov.vn
      WHERE ov.vstdate BETWEEN ${startDate} AND ${endDate}
      AND ov.main_dep = '010'
      AND ov.vsttime BETWEEN '08:00:00' AND '16:59:59'
      ${sql.raw(subFilters)}
      GROUP BY hour 
      ORDER BY hour
    `);

    // คำนวณจำนวน KPI Pass Rate
    // เกณฑ์มาตรฐานใหม่: ผู้ป่วยมีเวลารวมเสร็จสิ้น ≤ 60 นาที
    // สำหรับ Query ปัดเศษใหม่ ข้อมูลผลรวมทั้งหมด (total_wait) ออกมาเป็น "นาที" อยู่แล้ว
    // ดังนั้นเราสามารถหาค่าเปอร์เซ็นต์ที่ total_wait <= 60 จากข้อมูลหลังบ้านได้เลย 
    // หรือนับอัตราสำเร็จผ่านตัวแปร kpi_pass_count (ที่ SQL ชั้นในมีผลบวกรวม ≤ 60 นาที หรือ 3,600 วินาที)
    // ใน SQL ชั้นใน: wait_screen_diff + screen_diff + wait_doc1_diff + doc_time_diff + wait_rx_diff
    const totalPatients = Number(row.visit_cc || 0);
    const kpiPassCount = Number(row.visit_cc || 0) * (kpiPassRatePercent(extDb, startDate, endDate, subFilters) ? 0.8 : 0.85); // ตัววิเคราะห์หลอก fallback หากไม่มี

    // คิวรีพิเศษสำหรับหาจำนวนคนไข้ที่ผ่าน KPI 60 นาทีแบบถูกต้องตรงสูตรใหม่เป๊ะๆ 
    const [kpiStats]: any[] = await extDb.execute(sql`
      SELECT 
        SUM(CASE WHEN (
          TIMESTAMPDIFF(MINUTE, t1.service_end_datetime, t2.service_begin_datetime) + 
          (t2.service_time_second / 60) + 
          IFNULL(TIMESTAMPDIFF(MINUTE, t2.service_end_datetime, t3.service_begin_datetime), 0) + 
          IFNULL(t3.service_time_second / 60, 0) + 
          IFNULL(TIMESTAMPDIFF(MINUTE, t3.service_end_datetime, rx.rx_dispenser_datetime), 0)
        ) <= 60 THEN 1 ELSE 0 END) AS kpi_pass_count
      FROM (
        SELECT o.vn
        FROM ovst o
        LEFT JOIN opdscreen os ON os.vn = o.vn
        WHERE CONCAT(o.vstdate, ' ', o.vsttime) BETWEEN ${dateTimeStart} AND ${dateTimeEnd} 
          AND o.main_dep = '010'
          AND o.spclty = '01'
          AND o.vsttime BETWEEN '08:00:00' AND '16:00:00'
          ${sql.raw(filterConditions)}
      ) o
      JOIN ovst_service_time t1 ON t1.vn = o.vn AND t1.ovst_service_time_type_code = 'OPD-NEW-VISIT'
      JOIN ovst_service_time t2 ON t2.vn = o.vn AND t2.ovst_service_time_type_code = 'OPD-SCREEN'
      LEFT JOIN ovst_service_time t3 ON t3.vn = o.vn AND t3.ovst_service_time_type_code = 'OPD-DOCTOR' AND t3.service_begin_datetime >= t2.service_end_datetime
      LEFT JOIN rx_dispenser_detail rx ON rx.vn = o.vn AND rx.rx_dispenser_type_id='4' AND rx.confirm_substock_transaction = 'Y' AND rx.rx_dispenser_datetime >= t3.service_end_datetime
      WHERE t2.service_begin_datetime >= t1.service_end_datetime
    `);

    const realKpiPassCount = Number(kpiStats?.[0]?.kpi_pass_count || 0);

    return {
      stats: {
        departmentname: row.departmentname || 'OPD 7',
        // ส่งเป็นสตริงของเวลารวมเพื่อให้ระบบ Vue นำไปขึ้นชั่วโมง/นาทีได้ง่าย
        'รอซักประวัติ': `${row.wait_screen_cc}:00`,
        'ซักประวัติ': `${row.screen_cc}:00`,
        'รอตรวจ1': `${row.wait_doctor}:00`,
        'รอตรวจ2': '00:00',
        'แพทย์ตรวจ': `${row.doctor_cc}:00`,
        'รอรับยา': `${row.wait_drug_cc}:00`,
        'total_all': `${row.total_wait}:00`,

        m_wait_screen: Number(row.wait_screen_cc || 0),
        m_screen: Number(row.screen_cc || 0),
        m_wait_doc1: Number(row.wait_doctor || 0),
        m_wait_doc2: 0,
        m_doc_time: Number(row.doctor_cc || 0),
        m_wait_rx: Number(row.wait_drug_cc || 0),
        m_total_all: Number(row.total_wait || 0),
        
        m_min_total: Number(row.m_min_total || 0),
        m_max_total: Number(row.m_max_total || 0),
        total_patients: totalPatients,
        kpi_pass_count: realKpiPassCount
      },
      hourly_screen: hourlyScreen,
      hourly_doctor: hourlyDoctor,
      traffic: traffic,
      metadata: { startDate, endDate },
      status: 'success'
    };

  } catch (err: any) {
    console.error('Waiting Time API Error:', err);
    return { stats: null, status: 'error', message: err.message };
  }
});

// ฟังก์ชันจำลองอัตราผ่านชั่วคราวเผื่อกรณีขัดข้อง
function kpiPassRatePercent(db: any, start: any, end: any, filters: string): boolean {
  return true;
}
