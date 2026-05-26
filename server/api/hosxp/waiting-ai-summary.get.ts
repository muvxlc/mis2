import { db } from '../../utils/db';
import { externalDatabases } from '../../database/schema';
import { getExternalDb } from '../../utils/externalDb';
import { sql, eq, and } from 'drizzle-orm';

// In-Memory Cache เพื่อจำกัด Request และควบคุมโควตา Gemini API ฟรี
// Cache Key: `${startDate}_${endDate}`
interface CacheEntry {
  summary: string;
  expiresAt: number;
}
const aiSummaryCache = new Map<string, CacheEntry>();

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const startDate = query.startDate as string || new Date().toISOString().split('T')[0];
  const endDate = query.endDate as string || new Date().toISOString().split('T')[0];

  const cacheKey = `${startDate}_${endDate}`;
  const now = Date.now();

  // 1. ตรวจสอบข้อมูลใน Cache เพื่อป้องกันการยิงซ้ำและรักษาระดับการใช้งาน AI ฟรี
  if (aiSummaryCache.has(cacheKey)) {
    const cached = aiSummaryCache.get(cacheKey)!;
    if (now < cached.expiresAt) {
      console.log(`[AI-Summary] Serving cached summary for ${cacheKey}`);
      return { summary: cached.summary, cached: true };
    } else {
      aiSummaryCache.delete(cacheKey); // แคชหมดอายุ ลบออก
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

  const dateTimeStart = `${startDate} 05:00:00`;
  const dateTimeEnd = `${endDate} 16:00:00`;

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

    // 3. เชื่อมต่อ HOSxP เพื่อรวบรวมข้อมูลดิบสำหรับการส่งให้ AI สรุปเชิงคุณภาพ
    const extDb = await getExternalDb({
      id: config.id,
      type: config.type as 'mysql' | 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database
    });

    // 3.1 ดึงคิวหลัก (เวลารวมเฉลี่ย และ Min/Max)
    const [rawStats]: any[] = await extDb.execute(sql`
      SELECT 
        departmentname,
        AVG(wait_screen_diff)/60 AS m_wait_screen, 
        AVG(screen_diff)/60 AS m_screen, 
        AVG(wait_doc1_diff)/60 AS m_wait_doc1, 
        AVG(doc_time_diff)/60 AS m_doc_time, 
        AVG(wait_rx_diff)/60 AS m_wait_rx,
        (AVG(wait_screen_diff) + AVG(screen_diff) + AVG(wait_doc1_diff) + AVG(doc_time_diff) + AVG(wait_rx_diff))/60 AS m_total_all,
        MIN(wait_screen_diff + screen_diff + wait_doc1_diff + doc_time_diff + wait_rx_diff)/60 AS m_min_total,
        MAX(wait_screen_diff + screen_diff + wait_doc1_diff + doc_time_diff + wait_rx_diff)/60 AS m_max_total,
        COUNT(vn) AS total_patients,
        SUM(CASE WHEN (wait_screen_diff + screen_diff + wait_doc1_diff + doc_time_diff + wait_rx_diff) <= 3600 THEN 1 ELSE 0 END) AS kpi_pass_count
      FROM (
        SELECT 
          ov.vn, 
          s.department AS departmentname,
          TIMESTAMPDIFF(SECOND, 
            (SELECT MIN(service_begin_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code LIKE 'OPD-NEW-VISIT%'), 
            (SELECT MIN(service_begin_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-SCREEN')
          ) AS wait_screen_diff,
          
          TIMESTAMPDIFF(SECOND, 
            (SELECT MIN(service_begin_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-SCREEN'), 
            (SELECT MIN(service_end_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-SCREEN')
          ) AS screen_diff,
          
          TIMESTAMPDIFF(SECOND, 
            (SELECT MIN(service_end_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-SCREEN'), 
            (SELECT MIN(service_begin_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-DOCTOR')
          ) AS wait_doc1_diff,
          
          TIMESTAMPDIFF(SECOND, 
            (SELECT MIN(service_begin_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code LIKE 'OPD-NEW-VISIT%'), 
            (SELECT MIN(service_begin_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-DOCTOR')
          ) AS wait_doc2_diff,
          
          TIMESTAMPDIFF(SECOND, 
            (SELECT MIN(service_begin_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-DOCTOR'), 
            (SELECT MIN(service_end_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-DOCTOR')
          ) AS doc_time_diff,
          
          TIMESTAMPDIFF(SECOND, 
            (SELECT MIN(service_end_datetime) FROM ovst_service_time WHERE vn = ov.vn AND ovst_service_time_type_code = 'OPD-DOCTOR'), 
            (SELECT MIN(rx_dispenser_datetime) FROM rx_dispenser_detail WHERE vn = ov.vn)
          ) AS wait_rx_diff
        FROM ovst ov
        JOIN kskdepartment s ON ov.main_dep = s.depcode
        WHERE CONCAT(ov.vstdate, ' ', ov.vsttime) BETWEEN ${dateTimeStart} AND ${dateTimeEnd} 
        AND ov.main_dep = '010'
        AND ov.vsttime BETWEEN '05:00:00' AND '16:00:00'
      ) tt
      GROUP BY departmentname 
    `);

    if (!rawStats || rawStats.length === 0) {
      return { summary: "ไม่พบสถิติเวลารอคอยในช่วงเวลานี้เพื่อส่งวิเคราะห์", status: "no_data" };
    }

    const row = rawStats[0];

    // 3.2 ดึงสถิติจราจรปริมาณงานเพื่อหาชั่วโมงพีคสูงสุด
    const [traffic]: any[] = await extDb.execute(sql`
      SELECT 
          HOUR(vsttime) as hour, 
          COUNT(vn) as total 
      FROM ovst 
      WHERE vstdate BETWEEN ${startDate} AND ${endDate}
      AND main_dep = '010'
      AND vsttime BETWEEN '05:00:00' AND '16:59:59'
      GROUP BY hour 
      ORDER BY total DESC 
      LIMIT 1
    `);

    const peakHour = traffic && traffic.length > 0 ? traffic[0] : null;

    // 3.3 คำนวณเปอร์เซ็นต์ KPI Pass Rate
    const totalPatients = Number(row.total_patients || 0);
    const kpiPassCount = Number(row.kpi_pass_count || 0);
    const kpiPassRate = totalPatients > 0 ? Math.round((kpiPassCount / totalPatients) * 100) : 0;

    // 4. รวบรวม Prompt และส่งข้อมูลวิเคราะห์ไปหา Google Gemini API 1.5/2.5 Flash
    // สร้างบทวิเคราะห์ที่กระชับ ตรงจุด และสวยงามในรูปแบบ Markdown
    const prompt = `คุณคือระบบ AI ผู้เชี่ยวชาญด้านการวิเคราะห์ข้อมูลรอคอยและประสิทธิภาพการบริการสาธารณสุขของโรงพยาบาล (Hospital Flow Expert)
วิเคราะห์ข้อมูลสถิติระยะเวลารอคอยของแผนก ${row.departmentname || 'OPD 7'} สำหรับช่วงวันที่ ${startDate} ถึง ${endDate} ดังต่อไปนี้:

สถิติภาพรวม:
- จำนวนผู้รับบริการสะสมจริงทั้งหมด: ${totalPatients} ราย
- เวลาบริการรวมเฉลี่ย 5 ขั้นตอนหลัก: ${Math.round(row.m_total_all)} นาที
- เคสที่เสร็จเร็วที่สุด (Min): ${Math.round(row.m_min_total)} นาที
- เคสที่ช้าที่สุด (Max): ${Math.round(row.m_max_total)} นาที
- เปอร์เซ็นต์คนไข้ที่ได้รับการรักษาเสร็จสิ้นภายใน 60 นาที (KPI Pass Rate): ${kpiPassRate}% (จากเป้าหมาย SLA 80%)

สถิติรายจุดบริการ (เวลาเฉลี่ย):
1. จุดรอซักประวัติ: ${Math.round(row.m_wait_screen)} นาที (เป้าหมาย <= 20 นาที)
2. ขั้นตอนซักประวัติ: ${Math.round(row.m_screen)} นาที (เป้าหมาย <= 10 นาที)
3. จุดรอพบแพทย์: ${Math.round(row.m_wait_doc1)} นาที (เป้าหมาย <= 15 นาที)
4. ขั้นตอนการตรวจโรคโดยแพทย์: ${Math.round(row.m_doc_time)} นาที (เป้าหมาย <= 15 นาที)
5. จุดรอรับยา/บริการ: ${Math.round(row.m_wait_rx)} นาที (เป้าหมาย <= 15 นาที)

ข้อมูลชั่วโมงเร่งด่วนสูงสุด (Peak Volume):
${peakHour ? `- ช่วงเวลาพีคคือ ${peakHour.hour}:00 - ${peakHour.hour + 1}:00 น. มีคนไข้ไหลเข้ามาสูงสุดพร้อมกันถึง ${peakHour.total} รายในชั่วโมงเดียว` : '- ไม่มีข้อมูลช่วงชั่วโมงเร่งด่วน'}

งานของคุณ:
จงเขียน "บทสรุปวิเคราะห์การบริการระดับบริหาร (Executive Summary)" สำหรับผู้บริหารโรงพยาบาลเป็นภาษาไทยที่สุภาพ เป็นกันเอง สั้น กระชับ และตรงประเด็น โดยแยกเป็น 3 หัวข้อหลักๆ (ใช้สัญลักษณ์ไอคอนตกแต่งหัวข้อเพื่อความสวยงามพรีเมียม):

1. 📊 สภาพรวมประสิทธิภาพการบริการ (Flow Overview)
   - สรุปอย่างรวดเร็วว่าวันนี้แผนกทำเวลาเป็นอย่างไร ผ่านเกณฑ์ KPI ส่วนใหญ่หรือไม่ (ชี้เป้าเวลาเฉลี่ยและสัดส่วนที่ผ่าน SLA 17%)
2. ⚠️ จุดวิกฤตคอขวดที่พบ (Key Congestion Point)
   - ชี้เป้าว่าใน 5 จุดบริการ จุดใดที่ล่าช้าเกินเกณฑ์มากที่สุด และช่วงชั่วโมงพีคส่งผลอย่างไรบ้างต่อผู้ป่วย
3. 💡 ข้อเสนอแนะเชิงกลยุทธ์สำหรับการบริหารจัดการ (Actionable Recommendations)
   - แนะนำวิธีแก้ไขปัญหากำลังพลหรือการจัดสรรโฟลว์คนไข้ให้สอดคล้องกับชั่วโมงเร่งด่วนและการรอคอย เช่น การสลับคนหรือเพิ่มเจ้าหน้าที่จุดใด เพื่อให้เวลาเฉลี่ยเข้าเกณฑ์ KPI

กฎการตอบกลับ:
- ตอบกลับในภาษาไทยที่สละสลวย กระชับ เข้าใจง่าย 
- ความยาวรวมไม่เกิน 4-5 ย่อหน้าย่อย (ไม่เวิ่นเว้อหรือยาวเกินไปจนน่าเบื่อ เพื่อให้อ่านในหน้าจอขนาดกะทัดรัดได้อย่างพอดี)
- ใช้ Markdown สำหรับหัวข้อ ตัวหนา และลิสต์รายการให้อ่านง่าย สวยงาม`;

    // 5. ส่ง Request ไปยัง Google Gemini API (ใช้โมเดลล่าสุด gemini-flash-latest ตามคู่มือการใช้งาน)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
    
    console.log(`[AI-Summary] Fetching fresh AI analysis from Gemini API using headers...`);
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

    // 6. กำหนดระยะเวลาแคช (Ttl - Time To Live) ตามประเภทของวันที่เพื่อประหยัด Request
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = endDate >= todayStr;
    const ttlSeconds = isToday ? 15 * 60 : 24 * 60 * 60; // วันนี้แคช 15 นาที, อดีตแคช 24 ชั่วโมง

    aiSummaryCache.set(cacheKey, {
      summary: aiText,
      expiresAt: now + (ttlSeconds * 1000)
    });

    console.log(`[AI-Summary] Analysis complete. Cache saved for ${cacheKey}. TTL = ${ttlSeconds}s`);

    return { summary: aiText, cached: false };

  } catch (err: any) {
    console.error('Waiting AI Summary API Error:', err);
    return {
      summary: `⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลหรือเชื่อมต่อ AI สรุปผลการวิเคราะห์: ${err.message}`,
      status: "error"
    };
  }
});
