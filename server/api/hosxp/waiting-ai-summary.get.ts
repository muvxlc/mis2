import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';
import { getExternalDb } from '../../utils/externalDb';
import { sql, eq, and } from 'drizzle-orm';

// In-Memory Cache เพื่อจำกัด Request และควบคุมโควตา Gemini API ฟรี
interface CacheEntry {
  summary: string;
  expiresAt: number;
}
const aiSummaryCache = new Map<string, CacheEntry>();

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const startDate = query.startDate as string || new Date().toISOString().split('T')[0];
  const endDate = query.endDate as string || new Date().toISOString().split('T')[0];

  // ดึงค่า Dynamic Filters เพื่อใช้ในการกรองสถิติส่งให้ AI ให้มีตัวเลขตรงกับหน้าจอ
  const excludeWeekends = query.excludeWeekends === 'true';
  const excludeAppointed = query.excludeAppointed === 'true';
  const excludeLab = query.excludeLab === 'true';
  const excludeXray = query.excludeXray === 'true';

  const cacheKey = `${startDate}_${endDate}_w${excludeWeekends}_a${excludeAppointed}_l${excludeLab}_x${excludeXray}`;
  const now = Date.now();

  // 1. ตรวจสอบข้อมูลใน Cache
  if (aiSummaryCache.has(cacheKey)) {
    const cached = aiSummaryCache.get(cacheKey)!;
    if (now < cached.expiresAt) {
      console.log(`[AI-Summary] Serving cached summary for ${cacheKey}`);
      return { summary: cached.summary, cached: true };
    } else {
      aiSummaryCache.delete(cacheKey);
    }
  }

  const configNuxt = useRuntimeConfig();
  const apiKey = configNuxt.geminiApiKey || process.env.NUXT_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      summary: "⚠️ ระบบไม่สามารถสรุปข้อมูลได้เนื่องจากตรวจไม่พบ `NUXT_GEMINI_API_KEY` ในไฟล์ `.env` กรุณาใส่คีย์ของ Google Gemini API ก่อนเริ่มใช้งานฟีเจอร์นี้",
      status: "missing_api_key"
    };
  }

  const dateTimeStart = `${startDate} 08:00:00`;
  const dateTimeEnd = `${endDate} 16:00:59`;

  try {
    // 2. ดึงการตั้งค่าฐานข้อมูล HOSxP
    const [config] = await db.select()
      .from(externalDatabases)
      .where(and(
        eq(externalDatabases.isActive, 1),
        eq(externalDatabases.type, 'mysql')
      ))
      .limit(1);

    if (!config) {
      return { summary: "ไม่พบการเชื่อมต่อฐานข้อมูล HOSxP", status: "no_config" };
    }

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
    let filterConditions = '';
    if (excludeWeekends) {
      filterConditions += ` AND DAYOFWEEK(o.vstdate) NOT IN (1, 7)`;
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

    let subFilters = '';
    if (excludeWeekends) {
      subFilters += ` AND DAYOFWEEK(ov.vstdate) NOT IN (1, 7)`;
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

    // 3.1 ดึงคิวหลัก (ตาม SQL ปัดเศษนาที HOSxP ของโรงพยาบาล)
    const [rawStats]: any[] = await extDb.execute(sql`
      SELECT 
        departmentname,
        COUNT(DISTINCT o.vstdate) AS day_cc,
        COUNT(DISTINCT o.vn) AS visit_cc,
        
        ROUND(AVG(TIMESTAMPDIFF(MINUTE, t1.service_end_datetime, t2.service_begin_datetime)), 0) AS wait_screen_cc,
        ROUND(AVG(t2.service_time_second / 60), 0) AS screen_cc,
        
        ROUND(AVG(IFNULL(TIMESTAMPDIFF(MINUTE, t2.service_end_datetime, t3.service_begin_datetime), NULL)), 0) AS wait_doctor,
        ROUND(AVG(IFNULL(t3.service_time_second / 60, NULL)), 0) AS doctor_cc,

        ROUND(AVG(IFNULL(TIMESTAMPDIFF(MINUTE, t3.service_end_datetime, rx.rx_dispenser_datetime), NULL)), 0) AS wait_drug_cc,

        (
          ROUND(AVG(TIMESTAMPDIFF(MINUTE, t1.service_end_datetime, t2.service_begin_datetime)), 0) +
          ROUND(AVG(t2.service_time_second / 60), 0) +
          ROUND(AVG(IFNULL(TIMESTAMPDIFF(MINUTE, t2.service_end_datetime, t3.service_begin_datetime), NULL)), 0) +
          ROUND(AVG(IFNULL(t3.service_time_second / 60, NULL)), 0) +
          ROUND(AVG(IFNULL(TIMESTAMPDIFF(MINUTE, t3.service_end_datetime, rx.rx_dispenser_datetime), NULL)), 0)
        ) AS total_wait,
        
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
          AND o.vsttime BETWEEN '08:00:00' AND '16:00:59'
          ${sql.raw(filterConditions)}
      ) o
      JOIN (
        SELECT vn, MAX(service_end_datetime) AS service_end_datetime
        FROM ovst_service_time
        WHERE ovst_service_time_type_code = 'OPD-NEW-VISIT'
        GROUP BY vn
      ) t1 ON t1.vn = o.vn
      JOIN (
        SELECT vn, 
               MAX(service_begin_datetime) AS service_begin_datetime,
               MAX(service_end_datetime) AS service_end_datetime,
               MAX(service_time_second) AS service_time_second
        FROM ovst_service_time
        WHERE ovst_service_time_type_code = 'OPD-SCREEN'
        GROUP BY vn
      ) t2 ON t2.vn = o.vn
      LEFT JOIN (
        SELECT vn, 
               MAX(service_begin_datetime) AS service_begin_datetime,
               MAX(service_end_datetime) AS service_end_datetime,
               MAX(service_time_second) AS service_time_second
        FROM ovst_service_time
        WHERE ovst_service_time_type_code = 'OPD-DOCTOR'
        GROUP BY vn
      ) t3 ON t3.vn = o.vn AND t3.service_begin_datetime >= t2.service_end_datetime
      LEFT JOIN (
        SELECT vn, MAX(rx_dispenser_datetime) AS rx_dispenser_datetime
        FROM rx_dispenser_detail
        WHERE rx_dispenser_type_id = '4' AND confirm_substock_transaction = 'Y'
        GROUP BY vn
      ) rx ON rx.vn = o.vn AND rx.rx_dispenser_datetime >= t3.service_end_datetime
      WHERE t2.service_begin_datetime >= t1.service_end_datetime
      GROUP BY departmentname 
    `);

    if (!rawStats || rawStats.length === 0) {
      return { summary: "ไม่พบสถิติเวลารอคอยในช่วงเวลานี้เพื่อส่งวิเคราะห์", status: "no_data" };
    }

    const row = rawStats[0];

    // 3.2 ดึงสถิติจราจรปริมาณงานเพื่อหาชั่วโมงพีคสูงสุด
    const [traffic]: any[] = await extDb.execute(sql`
      SELECT 
          HOUR(ov.vsttime) as hour, 
          COUNT(ov.vn) as total 
      FROM ovst ov
      LEFT JOIN opdscreen os ON os.vn = ov.vn
      WHERE ov.vstdate BETWEEN ${startDate} AND ${endDate}
      AND ov.main_dep = '010'
      AND ov.vsttime BETWEEN '08:00:00' AND '16:00:59'
      ${sql.raw(subFilters)}
      GROUP BY hour 
      ORDER BY total DESC 
      LIMIT 1
    `);

    const peakHour = traffic && traffic.length > 0 ? traffic[0] : null;

    // 3.3 ดึงสถิติความสำเร็จ KPI 60 นาที
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
          AND o.vsttime BETWEEN '08:00:00' AND '16:00:59'
          ${sql.raw(filterConditions)}
      ) o
      JOIN (
        SELECT vn, MAX(service_end_datetime) AS service_end_datetime
        FROM ovst_service_time
        WHERE ovst_service_time_type_code = 'OPD-NEW-VISIT'
        GROUP BY vn
      ) t1 ON t1.vn = o.vn
      JOIN (
        SELECT vn, 
               MAX(service_begin_datetime) AS service_begin_datetime,
               MAX(service_end_datetime) AS service_end_datetime,
               MAX(service_time_second) AS service_time_second
        FROM ovst_service_time
        WHERE ovst_service_time_type_code = 'OPD-SCREEN'
        GROUP BY vn
      ) t2 ON t2.vn = o.vn
      LEFT JOIN (
        SELECT vn, 
               MAX(service_begin_datetime) AS service_begin_datetime,
               MAX(service_end_datetime) AS service_end_datetime,
               MAX(service_time_second) AS service_time_second
        FROM ovst_service_time
        WHERE ovst_service_time_type_code = 'OPD-DOCTOR'
        GROUP BY vn
      ) t3 ON t3.vn = o.vn AND t3.service_begin_datetime >= t2.service_end_datetime
      LEFT JOIN (
        SELECT vn, MAX(rx_dispenser_datetime) AS rx_dispenser_datetime
        FROM rx_dispenser_detail
        WHERE rx_dispenser_type_id = '4' AND confirm_substock_transaction = 'Y'
        GROUP BY vn
      ) rx ON rx.vn = o.vn AND rx.rx_dispenser_datetime >= t3.service_end_datetime
      WHERE t2.service_begin_datetime >= t1.service_end_datetime
    `);

    const totalPatients = Number(row.visit_cc || 0);
    const realKpiPassCount = Number(kpiStats?.[0]?.kpi_pass_count || 0);
    const kpiPassRate = totalPatients > 0 ? Math.round((realKpiPassCount / totalPatients) * 100) : 0;

    // 4. รวบรวม Prompt และส่งข้อมูลวิเคราะห์ไปหา Google Gemini API
    const prompt = `คุณคือระบบ AI ผู้เชี่ยวชาญด้านการวิเคราะห์ข้อมูลรอคอยและประสิทธิภาพการบริการสาธารณสุขของโรงพยาบาล (Hospital Flow Expert)
วิเคราะห์ข้อมูลสถิติระยะเวลารอคอยของแผนก ${row.departmentname || 'OPD 7'} สำหรับช่วงวันที่ ${startDate} ถึง ${endDate} ดังต่อไปนี้:

สถิติภาพรวม (คำนวณตามเกณฑ์การกรองที่เลือก):
- จำนวนผู้รับบริการสะสมจริงทั้งหมด: ${totalPatients} ราย
- เวลาบริการรวมเฉลี่ย 5 ขั้นตอนหลัก: ${row.total_wait} นาที
- เคสที่เสร็จเร็วที่สุด (Min): ${row.m_min_total} นาที
- เคสที่ช้าที่สุด (Max): ${row.m_max_total} นาที
- เปอร์เซ็นต์คนไข้ที่ได้รับการรักษาเสร็จสิ้นภายใน 60 นาที (KPI Pass Rate): ${kpiPassRate}% (จากเป้าหมาย SLA 80%)

สถิติรายจุดบริการ (เวลาเฉลี่ย):
1. จุดรอซักประวัติ: ${row.wait_screen_cc} นาที (เป้าหมาย <= 20 นาที)
2. ขั้นตอนซักประวัติ: ${row.screen_cc} นาที (เป้าหมาย <= 10 นาที)
3. จุดรอพบแพทย์: ${row.wait_doctor} นาที (เป้าหมาย <= 15 นาที)
4. ขั้นตอนการตรวจโรคโดยแพทย์: ${row.doctor_cc} นาที (เป้าหมาย <= 15 นาที)
5. จุดรอรับยา/บริการ: ${row.wait_drug_cc} นาที (เป้าหมาย <= 15 นาที)

ข้อมูลชั่วโมงเร่งด่วนสูงสุด (Peak Volume):
${peakHour ? `- ช่วงเวลาพีคคือ ${peakHour.hour}:00 - ${peakHour.hour + 1}:00 น. มีคนไข้ไหลเข้ามาสูงสุดพร้อมกันถึง ${peakHour.total} รายในชั่วโมงเดียว` : '- ไม่มีข้อมูลช่วงชั่วโมงเร่งด่วน'}

งานของคุณ:
จงเขียน "บทสรุปวิเคราะห์การบริการระดับบริหาร (Executive Summary)" สำหรับผู้บริหารโรงพยาบาลเป็นภาษาไทยที่สุภาพ เป็นกันเอง สั้น กระชับ และตรงประเด็น โดยแยกเป็น 3 หัวข้อหลักๆ:

1. 📊 สภาพรวมประสิทธิภาพการบริการ (Flow Overview)
   - สรุปอย่างรวดเร็วว่าวันนี้แผนกทำเวลาเป็นอย่างไร ผ่านเกณฑ์ KPI ส่วนใหญ่หรือไม่
2. ⚠️ จุดวิกฤตคอขวดที่พบ (Key Congestion Point)
   - ชี้เป้าว่าใน 5 จุดบริการ จุดใดที่ล่าช้าเกินเกณฑ์มากที่สุด และช่วงชั่วโมงพีคส่งผลอย่างไรบ้างต่อผู้ป่วย
3. 💡 ข้อเสนอแนะเชิงกลยุทธ์สำหรับการบริหารจัดการ (Actionable Recommendations)
   - แนะนำวิธีแก้ไขปัญหากำลังพลหรือการจัดสรรโฟลว์คนไข้ให้สอดคล้องกับชั่วโมงเร่งด่วนและการรอคอย เช่น การสลับคนหรือเพิ่มเจ้าหน้าที่จุดใด เพื่อให้เวลาเฉลี่ยเข้าเกณฑ์ KPI

กฎการตอบกลับ:
- ตอบกลับในภาษาไทยที่สละสลวย กระชับ เข้าใจง่าย 
- ความยาวรวมไม่เกิน 4-5 ย่อหน้าย่อย (ไม่เวิ่นเว้อหรือยาวเกินไปจนน่าเบื่อ เพื่อให้อ่านในหน้าจอขนาดกะทัดรัดได้อย่างพอดี)
- ใช้ Markdown สำหรับหัวข้อ ตัวหนา และลิสต์รายการให้อ่านง่าย สวยงาม`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
    
    console.log(`[AI-Summary] Fetching fresh AI analysis from Gemini API for dynamic filters...`);
    const apiResponse = await $fetch<any>(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000
        }
      }
    });

    const aiText = apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ ไม่สามารถสร้างบทวิเคราะห์จาก AI ได้ในขณะนี้";

    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = endDate >= todayStr;
    const ttlSeconds = isToday ? 15 * 60 : 24 * 60 * 60;

    aiSummaryCache.set(cacheKey, {
      summary: aiText,
      expiresAt: now + (ttlSeconds * 1000)
    });

    return { summary: aiText, cached: false };

  } catch (err: any) {
    console.error('Waiting AI Summary API Error:', err);
    return {
      summary: `⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลหรือเชื่อมต่อ AI สรุปผลการวิเคราะห์: ${err.message}`,
      status: "error"
    };
  }
});
