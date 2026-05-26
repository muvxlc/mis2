/**
 * Utility helper functions for OPD 7 Waiting Analysis calculations.
 * Auto-imported by Nuxt 4 in both client and server contexts.
 */

export interface WaitingFilters {
  excludeWeekends: boolean;
  excludeAppointed: boolean;
  excludeLab: boolean;
  excludeXray: boolean;
}

export interface PatientVisit {
  vn: string;
  vstdate: string;
  vsttime: string;
  departmentname: string;
  visit_hour: number;
  wait_screen_m: number | null;
  screen_m: string | number;
  wait_doctor_m: number;
  doctor_m: string | number;
  wait_drug_m: number;
  is_weekend: number;
  is_appointed: number;
  has_lab: number;
  has_xray: number;
}

/**
 * Format "HH:MM:SS" or "MM:SS" into a standard "MM:SS" format where minutes can exceed 60.
 */
export function formatMmSs(hms: string | null): string {
  if (!hms) return '00:00';
  const parts = hms.split(':');
  if (parts.length < 3) return hms;
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  const s = parseInt(parts[2] || '0', 10);
  const totalM = (h * 60) + m;
  return `${totalM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Filter raw visits array based on the 4 checkboxes.
 */
export function filterVisits(visits: PatientVisit[], filters: WaitingFilters): PatientVisit[] {
  let list = [...visits];

  // Data Sanitization / Outlier Capping (ล้างข้อมูลและจำกัดเวลาผิดปกติ เช่น พนักงานลืมกดปิดเคส HOSxP ข้ามวัน)
  // กำหนดให้เวลาของแต่ละขั้นตอนไม่น้อยกว่า 0 นาที และไม่เกิน 480 นาที (8 ชั่วโมง ซึ่งเป็นเวลาปฏิบัติงานสูงสุดต่อเวร)
  list = list.map(v => {
    const ws = v.wait_screen_m === null ? null : Math.max(0, Math.min(480, v.wait_screen_m));
    const s = Math.max(0, Math.min(480, parseFloat(String(v.screen_m || 0))));
    const wd = Math.max(0, Math.min(480, v.wait_doctor_m || 0));
    const d = Math.max(0, Math.min(480, parseFloat(String(v.doctor_m || 0))));
    const wrx = Math.max(0, Math.min(480, v.wait_drug_m || 0));

    return {
      ...v,
      wait_screen_m: ws,
      screen_m: s,
      wait_doctor_m: wd,
      doctor_m: d,
      wait_drug_m: wrx
    };
  });

  if (filters.excludeWeekends) {
    list = list.filter(v => v.is_weekend === 0);
  }
  if (filters.excludeAppointed) {
    list = list.filter(v => v.is_appointed === 0);
  }
  if (filters.excludeLab) {
    list = list.filter(v => v.has_lab === 0);
  }
  if (filters.excludeXray) {
    list = list.filter(v => v.has_xray === 0);
  }
  return list;
}

/**
 * Aggregate stats from a filtered visit list.
 */
export function calculateStats(list: PatientVisit[], defaultDeptName = 'จุดซักประวัติผู้ป่วยนอก') {
  const total_patients = list.length;
  const uniqueDates = new Set(list.map(v => v.vstdate));
  const day_cc = Math.max(1, uniqueDates.size);

  if (total_patients === 0) {
    return {
      departmentname: defaultDeptName,
      'รอซักประวัติ': '00:00',
      'ซักประวัติ': '00:00',
      'รอตรวจ1': '00:00',
      'รอตรวจ2': '00:00',
      'แพทย์ตรวจ': '00:00',
      'รอรับยา': '00:00',
      'total_all': '00:00',
      m_wait_screen: 0,
      m_screen: 0,
      m_wait_doc1: 0,
      m_wait_doc2: 0,
      m_doc_time: 0,
      m_wait_rx: 0,
      m_total_all: 0,
      m_min_total: 0,
      m_max_total: 0,
      total_patients: 0,
      kpi_pass_count: 0
    };
  }

  // 1. รอซักประวัติ
  const sum_wait_screen = list.reduce((acc, v) => acc + (v.wait_screen_m || 0), 0);
  const valid_wait_screen = list.filter(v => v.wait_screen_m !== null);
  const avg_wait_screen = valid_wait_screen.length > 0 ? (valid_wait_screen.reduce((acc, v) => acc + (v.wait_screen_m || 0), 0) / valid_wait_screen.length) : 0;
  const wait_screen_cc = avg_wait_screen > 0 ? Math.round((sum_wait_screen / day_cc) / avg_wait_screen) : 0;

  // 2. ซักประวัติ
  const screen_cc = Math.round(list.reduce((acc, v) => acc + parseFloat(String(v.screen_m || 0)), 0) / total_patients);

  // 3. รอตรวจ
  const sum_wait_doctor = list.reduce((acc, v) => acc + (v.wait_doctor_m || 0), 0);
  const valid_wait_doctor = list.filter(v => v.wait_doctor_m > 0);
  const avg_wait_doctor = valid_wait_doctor.length > 0 ? (valid_wait_doctor.reduce((acc, v) => acc + v.wait_doctor_m, 0) / valid_wait_doctor.length) : 0;
  const wait_doctor = avg_wait_doctor > 0 ? Math.round((sum_wait_doctor / day_cc) / avg_wait_doctor) : 0;

  // 4. แพทย์ตรวจ
  const valid_doctor = list.filter(v => parseFloat(String(v.doctor_m || 0)) > 0);
  const doctor_cc = valid_doctor.length > 0 ? Math.round(valid_doctor.reduce((acc, v) => acc + parseFloat(String(v.doctor_m)), 0) / valid_doctor.length) : 0;

  // 5. รอรับยา
  const sum_wait_rx = list.reduce((acc, v) => acc + (v.wait_drug_m || 0), 0);
  const valid_wait_rx = list.filter(v => v.wait_drug_m > 0);
  const avg_wait_rx = valid_wait_rx.length > 0 ? (valid_wait_rx.reduce((acc, v) => acc + v.wait_drug_m, 0) / valid_wait_rx.length) : 0;
  const wait_drug_cc = avg_wait_rx > 0 ? Math.round((sum_wait_rx / day_cc) / avg_wait_rx) : 0;

  // ผลรวมขั้นตอนเฉลี่ย
  const total_wait = wait_screen_cc + screen_cc + wait_doctor + doctor_cc + wait_drug_cc;

  // คำนวณค่าน้อยสุด / มากสุด ของเวลารวมต่อคนไข้
  const patientTotals = list.map(v => {
    return (v.wait_screen_m || 0) + parseFloat(String(v.screen_m || 0)) + (v.wait_doctor_m || 0) + parseFloat(String(v.doctor_m || 0)) + (v.wait_drug_m || 0);
  });
  const m_min_total = patientTotals.length > 0 ? Math.min(...patientTotals) : 0;
  const m_max_total = patientTotals.length > 0 ? Math.max(...patientTotals) : 0;

  // นับผู้ป่วยที่ใช้เวลารวม ≤ 60 นาที (KPI Pass)
  const kpi_pass_count = patientTotals.filter(t => t <= 60).length;

  return {
    departmentname: list[0]?.departmentname || defaultDeptName,
    'รอซักประวัติ': `${wait_screen_cc}:00`,
    'ซักประวัติ': `${screen_cc}:00`,
    'รอตรวจ1': `${wait_doctor}:00`,
    'รอตรวจ2': '00:00',
    'แพทย์ตรวจ': `${doctor_cc}:00`,
    'รอรับยา': `${wait_drug_cc}:00`,
    'total_all': `${total_wait}:00`,
    m_wait_screen: wait_screen_cc,
    m_screen: screen_cc,
    m_wait_doc1: wait_doctor,
    m_wait_doc2: 0,
    m_doc_time: doctor_cc,
    m_wait_rx: wait_drug_cc,
    m_total_all: total_wait,
    m_min_total: m_min_total,
    m_max_total: m_max_total,
    total_patients: total_patients,
    kpi_pass_count: kpi_pass_count
  };
}

/**
 * Calculate hourly screen averages.
 */
export function calculateHourlyScreen(list: PatientVisit[], timeSlots: number[]) {
  return timeSlots.map(hour => {
    const hourVisits = list.filter(v => v.visit_hour === hour && v.wait_screen_m !== null);
    if (hourVisits.length === 0) {
      return {
        visit_hour: hour,
        patient_count: 0,
        avg_wait_minutes: 0,
        max_wait_minutes: 0
      };
    }
    const total = hourVisits.length;
    const avg = hourVisits.reduce((acc, v) => acc + (v.wait_screen_m || 0), 0) / total;
    const max = Math.max(...hourVisits.map(v => v.wait_screen_m || 0));

    return {
      visit_hour: hour,
      patient_count: total,
      avg_wait_minutes: parseFloat(avg.toFixed(2)),
      max_wait_minutes: parseFloat(max.toFixed(2))
    };
  });
}

/**
 * Calculate hourly doctor averages.
 */
export function calculateHourlyDoctor(list: PatientVisit[], timeSlots: number[]) {
  return timeSlots.map(hour => {
    const hourVisits = list.filter(v => v.visit_hour === hour && v.wait_doctor_m > 0);
    if (hourVisits.length === 0) {
      return {
        visit_hour: hour,
        patient_count: 0,
        avg_wait_minutes: 0,
        max_wait_minutes: 0
      };
    }
    const total = hourVisits.length;
    const avg = hourVisits.reduce((acc, v) => acc + (v.wait_doctor_m || 0), 0) / total;
    const max = Math.max(...hourVisits.map(v => v.wait_doctor_m || 0));

    return {
      visit_hour: hour,
      patient_count: total,
      avg_wait_minutes: parseFloat(avg.toFixed(2)),
      max_wait_minutes: parseFloat(max.toFixed(2))
    };
  });
}

/**
 * Calculate traffic volumes.
 */
export function calculateTraffic(list: PatientVisit[], timeSlots: number[]) {
  return timeSlots.map(hour => {
    const hourVisits = list.filter(v => v.visit_hour === hour);
    return {
      hour: hour,
      total: hourVisits.length
    };
  });
}
