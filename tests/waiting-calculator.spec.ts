import { describe, it, expect } from 'vitest';
import {
  formatMmSs,
  filterVisits,
  calculateStats,
  calculateHourlyScreen,
  calculateHourlyDoctor,
  calculateTraffic,
  PatientVisit
} from '../utils/waiting-calculator';

// Mock Patient Visits Data for testing
const mockVisits: PatientVisit[] = [
  {
    vn: '1',
    vstdate: '2026-05-26',
    vsttime: '08:15:00',
    departmentname: 'จุดซักประวัติผู้ป่วยนอก',
    visit_hour: 8,
    wait_screen_m: 10,
    screen_m: 5,
    wait_doctor_m: 15,
    doctor_m: 10,
    wait_drug_m: 20,
    is_weekend: 0,
    is_appointed: 0,
    has_lab: 0,
    has_xray: 0
  },
  {
    vn: '2',
    vstdate: '2026-05-26',
    vsttime: '09:30:00',
    departmentname: 'จุดซักประวัติผู้ป่วยนอก',
    visit_hour: 9,
    wait_screen_m: 20,
    screen_m: '5.5',
    wait_doctor_m: 30,
    doctor_m: '10.5',
    wait_drug_m: 10,
    is_weekend: 0,
    is_appointed: 1, // Appointed patient
    has_lab: 1,      // Has Lab
    has_xray: 0
  },
  {
    vn: '3',
    vstdate: '2026-05-30', // Saturday (Weekend)
    vsttime: '10:45:00',
    departmentname: 'จุดซักประวัติผู้ป่วยนอก',
    visit_hour: 10,
    wait_screen_m: null, // Null screen wait
    screen_m: 0,
    wait_doctor_m: 0,
    doctor_m: 0,
    wait_drug_m: 0,
    is_weekend: 1, // Weekend
    is_appointed: 0,
    has_lab: 0,
    has_xray: 1    // Has X-ray
  }
];

describe('OPD 7 Waiting Calculator Utility Tests', () => {

  describe('formatMmSs() Formatter Tests', () => {
    it('should format HH:MM:SS format successfully into absolute total minutes', () => {
      expect(formatMmSs('01:15:30')).toBe('75:30');
      expect(formatMmSs('00:45:12')).toBe('45:12');
      expect(formatMmSs('02:00:00')).toBe('120:00');
    });

    it('should return 00:00 for null or empty strings', () => {
      expect(formatMmSs(null)).toBe('00:00');
      expect(formatMmSs('')).toBe('00:00');
    });

    it('should pass through short formats intact', () => {
      expect(formatMmSs('25:00')).toBe('25:00');
    });
  });

  describe('filterVisits() Filtering Tests', () => {
    it('should return all records when all filters are disabled (false)', () => {
      const filters = {
        excludeWeekends: false,
        excludeAppointed: false,
        excludeLab: false,
        excludeXray: false
      };
      const filtered = filterVisits(mockVisits, filters);
      expect(filtered.length).toBe(3);
    });

    it('should exclude weekend visits when excludeWeekends is true', () => {
      const filters = {
        excludeWeekends: true,
        excludeAppointed: false,
        excludeLab: false,
        excludeXray: false
      };
      const filtered = filterVisits(mockVisits, filters);
      expect(filtered.length).toBe(2);
      expect(filtered.find(v => v.vn === '3')).toBeUndefined();
    });

    it('should exclude appointed visits when excludeAppointed is true', () => {
      const filters = {
        excludeWeekends: false,
        excludeAppointed: true,
        excludeLab: false,
        excludeXray: false
      };
      const filtered = filterVisits(mockVisits, filters);
      expect(filtered.length).toBe(2);
      expect(filtered.find(v => v.vn === '2')).toBeUndefined();
    });

    it('should exclude lab visits when excludeLab is true', () => {
      const filters = {
        excludeWeekends: false,
        excludeAppointed: false,
        excludeLab: true,
        excludeXray: false
      };
      const filtered = filterVisits(mockVisits, filters);
      expect(filtered.length).toBe(2);
      expect(filtered.find(v => v.vn === '2')).toBeUndefined();
    });

    it('should exclude xray visits when excludeXray is true', () => {
      const filters = {
        excludeWeekends: false,
        excludeAppointed: false,
        excludeLab: false,
        excludeXray: true
      };
      const filtered = filterVisits(mockVisits, filters);
      expect(filtered.length).toBe(2);
      expect(filtered.find(v => v.vn === '3')).toBeUndefined();
    });

    it('should sanitize negative times to 0 and cap extreme outlier times to 480 minutes', () => {
      const outlierVisit: PatientVisit = {
        vn: '99',
        vstdate: '2026-05-26',
        vsttime: '08:00:00',
        departmentname: 'จุดซักประวัติผู้ป่วยนอก',
        visit_hour: 8,
        wait_screen_m: -10,      // Negative outlier wait
        screen_m: 26070,         // Giant outlier service
        wait_doctor_m: 500,      // Outlier wait
        doctor_m: -5,            // Negative service
        wait_drug_m: 26070,       // Giant outlier drug wait
        is_weekend: 0,
        is_appointed: 0,
        has_lab: 0,
        has_xray: 0
      };
      
      const filters = {
        excludeWeekends: false,
        excludeAppointed: false,
        excludeLab: false,
        excludeXray: false
      };
      
      const filtered = filterVisits([outlierVisit], filters);
      expect(filtered.length).toBe(1);
      
      const clean = filtered[0];
      expect(clean.wait_screen_m).toBe(0);     // Negative becomes 0
      expect(clean.screen_m).toBe(480);         // 26070 capped at 480
      expect(clean.wait_doctor_m).toBe(480);    // 500 capped at 480
      expect(clean.doctor_m).toBe(0);          // Negative becomes 0
      expect(clean.wait_drug_m).toBe(480);      // 26070 capped at 480
    });
  });

  describe('calculateStats() Aggregation Tests', () => {
    it('should return default zeroed stats when list is empty', () => {
      const stats = calculateStats([], 'ทดสอบแผนก');
      expect(stats.total_patients).toBe(0);
      expect(stats.departmentname).toBe('ทดสอบแผนก');
      expect(stats.m_total_all).toBe(0);
      expect(stats['รอซักประวัติ']).toBe('00:00');
    });

    it('should correctly calculate averages and sums on filtered lists', () => {
      // Filter out weekends (leaving visit 1 and 2)
      const list = [mockVisits[0], mockVisits[1]];
      const stats = calculateStats(list);

      expect(stats.total_patients).toBe(2);
      // wait_screen sum is 10 + 20 = 30. Day count = 1 (both same date).
      // Average wait screen of valid is (10+20)/2 = 15.
      // wait_screen_cc = (30 / 1) / 15 = 2.
      expect(stats.m_wait_screen).toBe(2);
      expect(stats['รอซักประวัติ']).toBe('2:00');

      // screen_cc = (5 + 5.5) / 2 = 5.25 -> rounded to 5
      expect(stats.m_screen).toBe(5);

      // doctor wait: 15 + 30 = 45. Avg = 22.5. cc = 45 / 22.5 = 2.
      expect(stats.m_wait_doc1).toBe(2);

      // doctor time: (10 + 10.5) / 2 = 10.25 -> rounded to 10
      expect(stats.m_doc_time).toBe(10);

      // drug wait: 20 + 10 = 30. Avg = 15. cc = 30 / 15 = 2.
      expect(stats.m_wait_rx).toBe(2);

      // total_all = 2 + 5 + 2 + 10 + 2 = 21
      expect(stats.m_total_all).toBe(21);
      expect(stats.total_all).toBe('21:00');

      // KPI pass rate: visit 1 total = 10+5+15+10+20 = 60 (Pass).
      // visit 2 total = 20+5.5+30+10.5+10 = 76 (Fail).
      // KPI pass count = 1.
      expect(stats.kpi_pass_count).toBe(1);
    });
  });

  describe('Hourly Calculations Tests', () => {
    const timeSlots = [8, 9, 10];

    it('should aggregate hourly screen stats correctly', () => {
      const result = calculateHourlyScreen(mockVisits, timeSlots);
      expect(result.length).toBe(3);
      expect(result[0]).toEqual({ visit_hour: 8, patient_count: 1, avg_wait_minutes: 10, max_wait_minutes: 10 });
      expect(result[1]).toEqual({ visit_hour: 9, patient_count: 1, avg_wait_minutes: 20, max_wait_minutes: 20 });
      // Hour 10 has null wait_screen_m, so count is 0
      expect(result[2]).toEqual({ visit_hour: 10, patient_count: 0, avg_wait_minutes: 0, max_wait_minutes: 0 });
    });

    it('should aggregate hourly doctor stats correctly', () => {
      const result = calculateHourlyDoctor(mockVisits, timeSlots);
      expect(result.length).toBe(3);
      expect(result[0]).toEqual({ visit_hour: 8, patient_count: 1, avg_wait_minutes: 15, max_wait_minutes: 15 });
      expect(result[1]).toEqual({ visit_hour: 9, patient_count: 1, avg_wait_minutes: 30, max_wait_minutes: 30 });
      // Hour 10 has wait_doctor_m = 0, so count is 0
      expect(result[2]).toEqual({ visit_hour: 10, patient_count: 0, avg_wait_minutes: 0, max_wait_minutes: 0 });
    });

    it('should aggregate hourly traffic correctly', () => {
      const result = calculateTraffic(mockVisits, timeSlots);
      expect(result.length).toBe(3);
      expect(result[0]).toEqual({ hour: 8, total: 1 });
      expect(result[1]).toEqual({ hour: 9, total: 1 });
      expect(result[2]).toEqual({ hour: 10, total: 1 });
    });
  });

});
