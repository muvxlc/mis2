<script setup lang="ts">
const today = new Date().toISOString().split('T')[0];
const startDate = ref(today);
const endDate = ref(today);

// การสลับช่วงเวลาสำหรับใช้วิเคราะห์ปัญหา (ดีฟอลต์เป็น standard 08:00 - 16:00)
const analysisPeriod = ref('standard'); // 'standard' | 'early' | 'full'
const startTime = computed(() => (analysisPeriod.value === 'early' || analysisPeriod.value === 'full') ? '05:00:00' : '08:00:00');
const endTime = computed(() => analysisPeriod.value === 'full' ? '23:59:59' : '16:00:59');

// 5 ตัวกรอง Reactive อัจฝริยะสำหรับคัดกรองข้อมูลสถิติ HOSxP (เริ่มต้นเป็น false เพื่อให้โหลดข้อมูลทั้งหมดก่อนเมื่อเข้าครั้งแรก)
const excludeWeekends = ref(false);
const excludeAppointed = ref(false);
const excludeLab = ref(false);
const excludeXray = ref(false);
const excludeProcedure = ref(false);
const includeNoDrug = ref(false);
const enableDemoBreakdown = ref(true); // เริ่มต้นเป็น true เพื่อให้การทำเดโมแสดงผลคาร์ดใหม่บนฐานข้อมูลตัวอย่างได้ทันที

const isBypassingCache = ref(false);
const lastUpdated = ref<string>('');

const { data: response, refresh: triggerRefresh, status } = await useAsyncData('waiting_stats', () => $fetch('/api/hosxp/waiting-time', {
    params: { 
        startDate: startDate.value, 
        endDate: endDate.value,
        startTime: startTime.value,
        endTime: endTime.value,
        bypassCache: isBypassingCache.value ? 'true' : 'false',
        demoMode: enableDemoBreakdown.value ? 'true' : 'false'
    }
}), {
    watch: [startDate, endDate, startTime, endTime, enableDemoBreakdown]
});

watch(() => response.value, (newVal) => {
    if (newVal) {
        lastUpdated.value = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}, { immediate: true });

const handleAnalyze = async () => {
    isBypassingCache.value = false;
    await triggerRefresh();
};

const handleForceSync = async () => {
    isBypassingCache.value = true;
    await triggerRefresh();
    isBypassingCache.value = false;
};

const rawVisits = computed(() => response.value?.visits || []);

// กรองรายเคสผู้ป่วยแบบ Reactive ฝั่งไคลเอนต์ (ตอบสนองไว 0ms)
const filteredVisits = computed(() => {
    return filterVisits(rawVisits.value, {
        excludeWeekends: excludeWeekends.value,
        excludeAppointed: excludeAppointed.value,
        excludeLab: excludeLab.value,
        excludeXray: excludeXray.value,
        excludeProcedure: excludeProcedure.value
    });
});

const getWidth = (val: number, max: number) => Math.min(100, (val / (max || 1)) * 100) + '%';

// ช็อตช่วงเวลาสำหรับการทำงาน
const timeSlots = computed(() => {
    if (analysisPeriod.value === 'full') {
        return [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    }
    return [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
});

// คำนวณสดในเบราว์เซอร์จากผู้ป่วยที่คัดแยกแล้ว
const displayHourlyScreen = computed(() => calculateHourlyScreen(filteredVisits.value, timeSlots.value));
const displayHourlyDoctor = computed(() => calculateHourlyDoctor(filteredVisits.value, timeSlots.value));
const displayTraffic = computed(() => calculateTraffic(filteredVisits.value, timeSlots.value));
const stats = computed(() => calculateStats(filteredVisits.value, undefined, includeNoDrug.value));

// ตัวจัดทริกเกอร์เลือกทั้งหมด / ล้างทั้งหมด
const setAllFilters = (val: boolean) => {
    excludeWeekends.value = val;
    excludeAppointed.value = val;
    excludeLab.value = val;
    excludeXray.value = val;
    excludeProcedure.value = val;
};

const maxPatientsScreen = computed(() => Math.max(...displayHourlyScreen.value.map(h => h.patient_count), 10));
const maxPatientsDoctor = computed(() => Math.max(...displayHourlyDoctor.value.map(h => h.patient_count), 10));
const maxTraffic = computed(() => Math.max(...displayTraffic.value.map(t => t.total || 0), 10));

const busiestHour = computed(() => {
    if (!displayTraffic.value.length) return null;
    const sorted = [...displayTraffic.value].sort((a, b) => (b.total || 0) - (a.total || 0));
    return sorted[0].total > 0 ? sorted[0] : null;
});

const shouldShowBreakdown = computed(() => {
    return enableDemoBreakdown.value || startDate.value >= '2026-06-17' || filteredVisits.value.some(v => v.wait_post_doc_m !== null || v.post_doc_m !== null);
});

const steps = computed(() => {
    const list = [
        { label: 'รอซักประวัติ', val: stats.value?.รอซักประวัติ, m: stats.value?.m_wait_screen, color: 'text-teal-500', bg: 'bg-teal-50', darkBg: 'dark:bg-teal-900/20', icon: 'i-heroicons-user-plus', key: 'wait_screen' },
        { label: 'ซักประวัติ', val: stats.value?.ซักประวัติ, m: stats.value?.m_screen, color: 'text-blue-500', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20', icon: 'i-heroicons-pencil-square', key: 'screen' },
        { label: 'รอพบแพทย์', val: stats.value?.รอตรวจ1, m: stats.value?.m_wait_doc1, color: 'text-[#ba895d]', bg: 'bg-[#fff8e1]', darkBg: 'dark:bg-[#ba895d]/10', icon: 'i-heroicons-user-group', key: 'wait_doctor' },
        { label: 'แพทย์ตรวจ', val: stats.value?.แพทย์ตรวจ, m: stats.value?.m_doc_time, color: 'text-green-500', bg: 'bg-green-50', darkBg: 'dark:bg-green-900/20', icon: 'i-heroicons-shield-check', key: 'doctor' }
    ];

    if (shouldShowBreakdown.value) {
        list.push(
            { label: 'รอหลังพบแพทย์', val: stats.value?.รอหลังพบแพทย์ || '00:00', m: stats.value?.m_wait_post_doc || 0, color: 'text-gray-500', bg: 'bg-gray-50', darkBg: 'dark:bg-gray-800/40', icon: 'i-heroicons-clock', key: 'wait_post_doc' },
            { label: 'บริการหลังพบแพทย์', val: stats.value?.บริการหลังพบแพทย์ || '00:00', m: stats.value?.m_post_doc || 0, color: 'text-purple-500', bg: 'bg-purple-50', darkBg: 'dark:bg-purple-900/20', icon: 'i-heroicons-clipboard-document-check', key: 'post_doc' },
            { label: 'รอรับยา', val: stats.value?.รอรับยา || '00:00', m: stats.value?.m_wait_rx || 0, color: 'text-orange-500', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/20', icon: 'i-heroicons-beaker', key: 'wait_rx' }
        );
    } else {
        list.push(
            { label: 'รอใบนัด/รอรับยา', val: stats.value?.รอรับยา, m: stats.value?.m_wait_rx, color: 'text-orange-500', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/20', icon: 'i-heroicons-beaker', key: 'wait_rx' }
        );
    }

    return list;
});

const stackedBarSegments = computed(() => {
    const segments = [
        { val: stats.value?.m_wait_screen || 0, color: 'bg-teal-400', label: 'รอซักประวัติ' },
        { val: stats.value?.m_screen || 0, color: 'bg-blue-400', label: 'ซักประวัติ' },
        { val: stats.value?.m_wait_doc1 || 0, color: 'bg-[#ba895d]', label: 'รอพบแพทย์' },
        { val: stats.value?.m_doc_time || 0, color: 'bg-green-400', label: 'แพทย์ตรวจ' }
    ];

    if (shouldShowBreakdown.value) {
        segments.push(
            { val: stats.value?.m_wait_post_doc || 0, color: 'bg-gray-400', label: 'รอหลังพบแพทย์' },
            { val: stats.value?.m_post_doc || 0, color: 'bg-purple-400', label: 'บริการหลังพบแพทย์' },
            { val: stats.value?.m_wait_rx || 0, color: 'bg-orange-400', label: 'รอรับยา' }
        );
    } else {
        segments.push(
            { val: stats.value?.m_wait_rx || 0, color: 'bg-orange-400', label: 'รอใบนัด/รอรับยา' }
        );
    }

    return segments;
});

// Modal and details view variables
const isModalOpen = ref(false);
const activeStepKey = ref('');
const activeStepLabel = ref('');
const searchQuery = ref('');

// VN Details states and helpers
const selectedVn = ref<string | null>(null);
const isVnModalOpen = ref(false);
const selectedVnDetailsData = ref<any>(null);
const selectedVnDoctorSigns = ref<any[]>([]);
const isVnLoading = ref(false);

const openVnDetails = async (vn: string) => {
    if (!vn) return;
    const cleanVn = vn.trim();
    selectedVn.value = cleanVn;
    isVnModalOpen.value = true;
    isVnLoading.value = true;
    selectedVnDetailsData.value = null;
    selectedVnDoctorSigns.value = [];

    // Query HOSxP directly for this VN to retrieve full timeline & doctor signatures
    try {
        const res = await $fetch<{ visits: any[], doctorSigns?: any[] }>('/api/hosxp/waiting-time', {
            params: { vn: cleanVn }
        });
        if (res && res.visits && res.visits.length > 0) {
            selectedVnDetailsData.value = res.visits[0];
            selectedVnDoctorSigns.value = res.doctorSigns || [];
        }
    } catch (err) {
        console.error('Error fetching VN details:', err);
    } finally {
        isVnLoading.value = false;
    }
};

const searchVnInput = ref('');
const vnSuggestions = computed(() => {
    const q = searchVnInput.value.trim().toLowerCase();
    if (!q) return [];
    return filteredVisits.value
        .filter(v => v.vn.toLowerCase().includes(q))
        .slice(0, 5);
});

const selectSuggestedVn = (vn: string) => {
    searchVnInput.value = '';
    openVnDetails(vn);
};

const openDetailsModal = (step: any) => {
    activeStepKey.value = step.key;
    activeStepLabel.value = step.label;
    searchQuery.value = '';
    isModalOpen.value = true;
};

const getKpiThreshold = (key: string) => {
    const thresholds: Record<string, number> = {
        wait_screen: 20,
        screen: 10,
        wait_doctor: 15,
        doctor: 15,
        wait_post_doc: 10,
        post_doc: 10,
        wait_rx: 15
    };
    return thresholds[key] || 20;
};

const modalVisits = computed(() => {
    if (!activeStepKey.value) return [];
    
    const propMap: Record<string, string> = {
        wait_screen: 'wait_screen_m',
        screen: 'screen_m',
        wait_doctor: 'wait_doctor_m',
        doctor: 'doctor_m',
        wait_post_doc: 'wait_post_doc_m',
        post_doc: 'post_doc_m',
        wait_rx: 'wait_drug_m'
    };
    
    const propName = propMap[activeStepKey.value];
    if (!propName) return [];
    
    let visitsList = filteredVisits.value
        .filter(v => {
            const val = v[propName as keyof PatientVisit];
            if (activeStepKey.value === 'wait_rx' && includeNoDrug.value) {
                return true;
            }
            if (val === null || val === undefined) return false;
            
            // Align with calculateStats: only average patients with active service times
            if (activeStepKey.value === 'wait_doctor' || activeStepKey.value === 'doctor' || activeStepKey.value === 'wait_rx' || activeStepKey.value === 'wait_post_doc' || activeStepKey.value === 'post_doc') {
                return parseFloat(String(val)) > 0;
            }
            return true;
        })
        .map(v => {
            const val = v[propName as keyof PatientVisit];
            const numVal = val === null || val === undefined ? 0 : parseFloat(String(val));
            return {
                vn: v.vn,
                hn: v.hn,
                vstdate: v.vstdate,
                vsttime: v.vsttime,
                value: numVal
            };
        });
    
    // Sort descending by value (outliers first)
    visitsList.sort((a, b) => b.value - a.value);
    
    if (searchQuery.value.trim()) {
        const q = searchQuery.value.trim().toLowerCase();
        visitsList = visitsList.filter(v => v.vn.toLowerCase().includes(q) || (v.hn && v.hn.toLowerCase().includes(q)));
    }
    
    return visitsList;
});

const modalStats = computed(() => {
    const visits = modalVisits.value;
    if (visits.length === 0) return { average: 0, max: 0 };
    const values = visits.map(v => v.value);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const average = sum / values.length;
    const max = Math.max(...values);
    return { average, max };
});

const exportToCSV = () => {
    if (!activeStepLabel.value || modalVisits.value.length === 0) return;
    
    const headers = ['#', 'VN', 'HN', 'Date', 'Time', 'Duration_Minutes', 'Status'];
    const rows = modalVisits.value.map((v, i) => [
        i + 1,
        v.vn,
        v.hn || '',
        v.vstdate,
        v.vsttime,
        Math.round(v.value),
        v.value > getKpiThreshold(activeStepKey.value) ? 'FAIL' : 'PASS'
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeStepLabel.value}_${startDate.value}_to_${endDate.value}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const kpiPassRate = computed(() => {
    if (!stats.value || !stats.value.total_patients) return 0;
    return Math.round((stats.value.kpi_pass_count / stats.value.total_patients) * 100);
});

const peakHourBottleneck = computed(() => {
    if (!busiestHour.value) return null;
    const peakHour = busiestHour.value.hour;
    
    const screenWait = displayHourlyScreen.value.find(d => d.visit_hour === peakHour)?.avg_wait_minutes || 0;
    const docWait = displayHourlyDoctor.value.find(d => d.visit_hour === peakHour)?.avg_wait_minutes || 0;
    
    if (screenWait === 0 && docWait === 0) return 'ไม่มีข้อมูลจุดหน่วง';
    return screenWait > docWait 
        ? `รอซักประวัติ (${Math.round(screenWait)} นาที)` 
        : `รอพบแพทย์ (${Math.round(docWait)} นาที)`;
});

const activeServiceTime = computed(() => {
    if (!stats.value) return 0;
    return (stats.value.m_screen || 0) + 
           (stats.value.m_doc_time || 0) + 
           (stats.value.m_post_doc || 0);
});

const idleWaitingTime = computed(() => {
    if (!stats.value) return 0;
    return (stats.value.m_wait_screen || 0) + 
           (stats.value.m_wait_doc1 || 0) + 
           (stats.value.m_wait_post_doc || 0) + 
           (stats.value.m_wait_rx || 0);
});

const activePercentage = computed(() => {
    const total = activeServiceTime.value + idleWaitingTime.value;
    if (total === 0) return 0;
    return Math.round((activeServiceTime.value / total) * 100);
});

const waitPercentage = computed(() => {
    const total = activeServiceTime.value + idleWaitingTime.value;
    if (total === 0) return 0;
    return Math.round((idleWaitingTime.value / total) * 100);
});

const peakVsNormalRatio = computed(() => {
    if (!displayTraffic.value.length || !busiestHour.value) return 1;
    const peakTotal = busiestHour.value.total;
    const otherHours = displayTraffic.value.filter(t => t.hour !== busiestHour.value.hour);
    if (!otherHours.length) return 1;
    const avgNormal = otherHours.reduce((acc, curr) => acc + (curr.total || 0), 0) / otherHours.length;
    if (avgNormal === 0) return 1;
    return (peakTotal / avgNormal).toFixed(1);
});

// Helper functions for dynamic multi-stage heatmap coloring
const getScreeningLoadClass = (count: number, max: number) => {
    if (count === 0) return 'bg-gray-50 dark:bg-gray-800/40 text-gray-200 dark:text-gray-750';
    const ratio = count / (max || 1);
    if (ratio <= 0.15) return 'bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 border border-teal-100/50 dark:border-teal-900/30';
    if (ratio <= 0.35) return 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300';
    if (ratio <= 0.60) return 'bg-teal-400 dark:bg-teal-600 text-white';
    if (ratio <= 0.85) return 'bg-orange-400 dark:bg-orange-600 text-white';
    return 'bg-red-500 dark:bg-red-600 text-white shadow-lg shadow-red-500/20 animate-pulse-slow';
};

const getScreeningWaitClass = (avg: number, count: number) => {
    if (count === 0 || avg === 0) return 'bg-gray-50 dark:bg-gray-800/40 text-gray-200 dark:text-gray-750';
    if (avg <= 10) return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30';
    if (avg <= 20) return 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300';
    if (avg <= 30) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
    if (avg <= 45) return 'bg-orange-400 dark:bg-orange-600 text-white';
    return 'bg-red-500 dark:bg-red-600 text-white shadow-lg shadow-red-500/20';
};

const getPhysicianLoadClass = (count: number, max: number) => {
    if (count === 0) return 'bg-gray-50 dark:bg-gray-800/40 text-gray-200 dark:text-gray-750';
    const ratio = count / (max || 1);
    if (ratio <= 0.15) return 'bg-amber-50 dark:bg-amber-950/20 text-[#ba895d] dark:text-[#d4a373] border border-amber-100/50 dark:border-amber-900/30';
    if (ratio <= 0.35) return 'bg-[#fff8e1] dark:bg-amber-900/20 text-[#ba895d] dark:text-[#d4a373]';
    if (ratio <= 0.60) return 'bg-[#e3b284] dark:bg-[#c58d55] text-white';
    if (ratio <= 0.85) return 'bg-[#ba895d] dark:bg-[#966b44] text-white';
    return 'bg-red-500 dark:bg-red-600 text-white shadow-lg shadow-red-500/20';
};

const getPhysicianWaitClass = (avg: number, count: number) => {
    if (count === 0 || avg === 0) return 'bg-gray-50 dark:bg-gray-800/40 text-gray-200 dark:text-gray-750';
    if (avg <= 15) return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30';
    if (avg <= 30) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-[#d4a373]';
    if (avg <= 45) return 'bg-orange-400 dark:bg-orange-600 text-white';
    return 'bg-red-500 dark:bg-red-600 text-white shadow-lg shadow-red-500/20';
};

const safeNum = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const n = parseFloat(String(val));
    return isNaN(n) ? 0 : n;
};

</script>

<template>
    <div class="space-y-10 font-thai pb-20">
        <!-- Modern Header Section -->
        <div class="bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative overflow-hidden">
            <div class="relative z-10 flex items-center gap-6">
                <div class="w-20 h-20 bg-gradient-to-tr from-[#24695c] to-[#45b39d] rounded-[1.8rem] flex items-center justify-center text-white text-4xl shadow-xl shadow-[#24695c]/20">
                    <UIcon name="i-heroicons-clock" />
                </div>
                <div>
                    <h1 class="text-4xl font-black tracking-tight text-[#2c323f] dark:text-white uppercase italic leading-none">Waiting Analysis</h1>
                    <p class="text-[#24695c] font-bold text-sm mt-2 flex items-center gap-2">
                        <span class="w-2 h-2 bg-[#24695c] rounded-full animate-ping"></span>
                        สรุปสถิติระยะเวลารอคอยเฉลี่ย: <span class="uppercase tracking-wider">{{ stats?.departmentname || 'OPD 7' }}</span>
                    </p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-5 bg-[#f5f7fb] dark:bg-gray-800/50 rounded-[2.5rem] border-2 border-white dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none z-10 w-full items-stretch">
                <div class="flex flex-col px-6 py-3 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800/80">
                    <span class="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Date Range Start</span>
                    <input v-model="startDate" type="date" class="bg-transparent border-none font-black text-[#2c323f] dark:text-white focus:ring-0 outline-none text-sm p-0 w-full" />
                </div>
                <div class="flex flex-col px-6 py-3 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800/80">
                    <span class="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Date Range End</span>
                    <input v-model="endDate" type="date" class="bg-transparent border-none font-black text-[#2c323f] dark:text-white focus:ring-0 outline-none text-sm p-0 w-full" />
                </div>
                <div class="flex flex-col px-6 py-3 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800/80 justify-center">
                    <span class="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Analysis Period (ช่วงเวลากรอง)</span>
                    <select v-model="analysisPeriod" class="bg-transparent border-none font-black text-[#2c323f] dark:text-white focus:ring-0 outline-none text-sm cursor-pointer pr-8 py-0 w-full">
                        <option value="standard" class="dark:bg-gray-900 text-gray-800 dark:text-white">08:00 - 16:00 (เวลามาตรฐาน)</option>
                        <option value="early" class="dark:bg-gray-900 text-gray-800 dark:text-white">05:00 - 16:00 (วิเคราะห์เคสเช้าตรู่)</option>
                        <option value="full" class="dark:bg-gray-900 text-gray-800 dark:text-white">05:00 - 23:59 (เวลาบริการทั้งหมด/เคสนอกเวลา)</option>
                    </select>
                </div>
                <div class="flex flex-col justify-center gap-2">
                    <UButton 
                        icon="i-heroicons-arrow-path" 
                        @click="handleAnalyze" 
                        :loading="status === 'pending' && !isBypassingCache"
                        class="bg-[#24695c] hover:bg-[#1a4d43] text-white rounded-2xl px-8 font-black shadow-xl shadow-[#24695c]/30 h-14 justify-center w-full"
                    >
                        ANALYZE
                    </UButton>
                    <div class="flex flex-col items-center justify-center gap-1">
                        <span class="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                            <UIcon :name="response?.cached ? 'i-heroicons-circle-stack' : 'i-heroicons-bolt'" class="text-xs" />
                            {{ response?.cached ? 'แสดงข้อมูลจากแคช' : 'ดึงข้อมูลสดจาก HOSxP' }}
                            <span v-if="lastUpdated">({{ lastUpdated }} น.)</span>
                        </span>
                        <button 
                            @click="handleForceSync" 
                            :disabled="status === 'pending'"
                            type="button"
                            class="text-[10px] font-black text-[#24695c] hover:text-[#1a4d43] dark:text-[#50b49f] dark:hover:text-[#6cdcb3] underline flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <UIcon name="i-heroicons-arrow-path" :class="{ 'animate-spin': status === 'pending' && isBypassingCache }" />
                            ดึงข้อมูลล่าสุดจาก HOSxP
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Decorative background elements -->
            <div class="absolute -right-20 -top-20 w-80 h-80 bg-[#24695c]/5 rounded-full blur-3xl"></div>
            <div class="absolute -left-20 -bottom-20 w-64 h-64 bg-[#ba895d]/5 rounded-full blur-3xl"></div>
        </div>

        <!-- Dynamic Filters & VN Search Section -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Left: Dynamic Analytics Filters Panel -->
            <div class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50 dark:border-gray-800 pb-4">
                    <div class="flex items-center gap-3">
                        <UIcon name="i-heroicons-adjustments-horizontal" class="text-[#24695c] text-2xl" />
                        <span class="text-xs font-black text-gray-700 dark:text-white uppercase tracking-wider">HOSxP Dynamic Filters (ตัวกรองข้อมูลพิเศษ)</span>
                    </div>
                    <div class="flex gap-3">
                        <UButton 
                            size="xs" 
                            variant="soft" 
                            color="teal" 
                            @click="setAllFilters(true)"
                            class="font-black text-[10px] uppercase tracking-wider rounded-lg px-3 py-1"
                        >
                            เลือกทั้งหมด
                        </UButton>
                        <UButton 
                            size="xs" 
                            variant="soft" 
                            color="gray" 
                            @click="setAllFilters(false)"
                            class="font-black text-[10px] uppercase tracking-wider rounded-lg px-3 py-1"
                        >
                            ล้างทั้งหมด
                        </UButton>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    <UCheckbox v-model="excludeWeekends" label="กรองจันทร์ - ศุกร์" />
                    <UCheckbox v-model="excludeAppointed" label="ไม่เอาเคสผู้ป่วยนัด" />
                    <UCheckbox v-model="excludeLab" label="ไม่เอาเคสส่ง Lab" />
                    <UCheckbox v-model="excludeXray" label="ไม่เอาเคสส่ง X-Ray" />
                    <UCheckbox v-model="excludeProcedure" label="ไม่เอาเคสทำหัตถการ" />
                    <UCheckbox v-model="includeNoDrug" label="คำนวณคนที่ไม่ได้รับยาด้วย (คิดเป็น 0 นาที)" />
                    <UCheckbox v-model="enableDemoBreakdown" label="เปิดแยกห้องหลังพบแพทย์ 042 (รวมข้อมูลย้อนหลัง)" />
                </div>
            </div>
            
            <!-- Right: Direct VN Search Card -->
            <div class="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between relative group">
                <div class="space-y-4">
                    <div class="flex items-center gap-3">
                        <UIcon name="i-heroicons-magnifying-glass-circle" class="text-[#ba895d] text-2xl" />
                        <span class="text-xs font-black text-gray-700 dark:text-white uppercase tracking-wider">Direct VN Search & Timeline (ค้นหา VN โดยตรง)</span>
                    </div>
                    <p class="text-[11px] font-bold text-gray-400">ระบุเลขที่ VN เพื่อวิเคราะห์ขั้นตอนบริการและระยะเวลารอคอยทันที</p>
                    
                    <div class="relative">
                        <input 
                            v-model="searchVnInput" 
                            type="text" 
                            placeholder="ระบุ VN เช่น 69xxxxxxx" 
                            class="w-full pl-4 pr-12 py-3 bg-[#f5f7fb] dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-700 dark:text-white focus:outline-none focus:border-[#24695c] focus:ring-1 focus:ring-[#24695c] placeholder-gray-400"
                            @keydown.enter="openVnDetails(searchVnInput)"
                        />
                        <button 
                            @click="openVnDetails(searchVnInput)"
                            class="absolute right-2 top-2 bottom-2 px-3 bg-[#24695c] hover:bg-[#1a4d43] text-white rounded-xl flex items-center justify-center transition-colors"
                        >
                            <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4" />
                        </button>
                    </div>

                    <!-- Autocomplete Suggestions -->
                    <div v-if="vnSuggestions.length > 0" class="absolute left-8 right-8 mt-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-gray-55 dark:divide-gray-800">
                        <div 
                            v-for="v in vnSuggestions" 
                            :key="v.vn" 
                            @click="selectSuggestedVn(v.vn)"
                            class="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-[#f5f7fb] dark:hover:bg-gray-800/50 cursor-pointer flex justify-between items-center transition-colors"
                        >
                            <span class="text-[#24695c] dark:text-[#2dd4bf]">{{ v.vn }}</span>
                            <span class="text-gray-400 font-normal">{{ v.vsttime }} ({{ Math.round((v.wait_screen_m || 0) + parseFloat(String(v.screen_m || 0)) + (v.wait_doctor_m || 0) + parseFloat(String(v.doctor_m || 0)) + (v.wait_post_doc_m || 0) + parseFloat(String(v.post_doc_m || 0)) + (v.wait_drug_m || 0)) }} นาที)</span>
                        </div>
                    </div>
                </div>

                <div class="mt-4 pt-4 border-t border-gray-55 dark:border-gray-800 flex items-center justify-between text-[10px] font-black text-gray-400">
                    <span>วิเคราะห์ย้อนหลังได้ไม่จำกัดวัน</span>
                    <span class="text-[#ba895d] italic">HOSxP Live Query</span>
                </div>
            </div>
        </div>

        <div v-if="stats" class="space-y-12">
            <!-- Summary Metrics Section -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <!-- Total Journey Hero Card -->
                <div class="lg:col-span-5 bg-gradient-to-br from-[#2c323f] to-[#1a1a2e] rounded-[2.5rem] p-8 text-white shadow-2xl shadow-gray-900/20 relative overflow-hidden group flex flex-col justify-between min-h-[420px]">
                    <div class="relative z-10 flex flex-col justify-between h-full space-y-6">
                        <!-- Top Row: Badge & Average Total Time -->
                        <div>
                            <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 mb-4">
                                <span class="w-1.5 h-1.5 bg-[#ba895d] rounded-full shadow-[0_0_8px_#ba895d]"></span>
                                <span class="text-[9px] font-black uppercase tracking-widest text-white italic">Average Total Journey</span>
                            </div>
                            
                            <div class="flex items-baseline gap-2.5 flex-wrap">
                                <h2 class="text-4xl sm:text-5xl font-black italic tracking-tighter drop-shadow-2xl leading-none">{{ formatMmSs(stats.total_all) }}</h2>
                                <span class="text-xs font-bold text-white/30 uppercase tracking-widest italic">Min:Sec</span>
                            </div>
                        </div>

                        <!-- Service vs Wait Breakdown (New Feature to fill space with premium insight) -->
                        <div class="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                            <span class="text-[9px] font-black text-white/50 uppercase tracking-wider block mb-1">Journey Composition</span>
                            <div class="h-2 rounded-full overflow-hidden flex bg-gray-800 p-0.5">
                                <div class="h-full bg-amber-500 rounded-l" :style="{ width: waitPercentage + '%' }" title="Waiting Time"></div>
                                <div class="h-full bg-emerald-400 rounded-r" :style="{ width: activePercentage + '%' }" title="Active Service Time"></div>
                            </div>
                            <div class="flex justify-between items-center text-[10px]">
                                <div class="flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                                    <span class="text-white/60">Wait: <strong class="text-white font-bold tabular-nums">{{ waitPercentage }}%</strong> <span class="text-[8px] text-white/40">({{ Math.round(idleWaitingTime) }}m)</span></span>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                                    <span class="text-white/60">Active: <strong class="text-white font-bold tabular-nums">{{ activePercentage }}%</strong> <span class="text-[8px] text-white/40">({{ Math.round(activeServiceTime) }}m)</span></span>
                                </div>
                            </div>
                        </div>

                        <!-- Middle Row: Slim progress bar & status -->
                        <div class="space-y-2">
                            <div class="flex justify-between items-end">
                                <div class="flex flex-col">
                                    <span class="text-[9px] font-black text-white/40 uppercase tracking-wider">Flow Efficiency Status</span>
                                    <span class="text-sm font-bold" :class="stats.m_total_all > 60 ? 'text-[#e6a23c]' : 'text-emerald-400'">
                                        {{ stats.m_total_all > 60 ? 'Suboptimal Flow' : 'Optimal Efficiency' }}
                                    </span>
                                </div>
                                <span class="text-[10px] font-black bg-white/5 px-2 py-0.5 rounded border border-white/10 tabular-nums">{{ Math.round(stats.m_total_all) }}m / 60m</span>
                            </div>
                            <div class="h-1.5 bg-black/40 rounded-full border border-white/5 shadow-inner overflow-hidden">
                                <div class="h-full bg-gradient-to-r rounded-full transition-all duration-[2500ms] ease-out shadow-[0_0_10px_rgba(36,105,92,0.4)]" 
                                     :class="stats.m_total_all > 60 ? 'from-[#ba895d] to-[#e6a23c]' : 'from-[#24695c] to-emerald-400'"
                                     :style="{ width: getWidth(stats.m_total_all, 120) }"></div>
                            </div>
                        </div>

                        <!-- Bottom Row: 3-column Analytical Grid -->
                        <div class="grid grid-cols-3 gap-2.5 pt-4 border-t border-white/10">
                            <!-- Col 1: KPI Pass Rate -->
                            <div class="flex flex-col">
                                <span class="text-[8px] font-black text-white/40 uppercase tracking-wider mb-1 truncate">KPI Pass Rate</span>
                                <span class="text-lg font-black italic leading-none" :class="kpiPassRate > 80 ? 'text-emerald-400' : 'text-[#ba895d]'">
                                    {{ kpiPassRate }}%
                                </span>
                                <span class="text-[8px] font-bold text-white/30 mt-1">SLA Target 80%</span>
                            </div>
                            <!-- Col 2: Total Patients -->
                            <div class="flex flex-col border-l border-white/10 pl-3">
                                <span class="text-[8px] font-black text-white/40 uppercase tracking-wider mb-1 truncate">Total Volume</span>
                                <span class="text-lg font-black text-white italic leading-none">{{ stats.total_patients }}</span>
                                <span class="text-[8px] font-bold text-white/30 mt-1">Registered Cases</span>
                            </div>
                            <!-- Col 3: Extremes (Min/Max) -->
                            <div class="flex flex-col border-l border-white/10 pl-3">
                                <span class="text-[8px] font-black text-white/40 uppercase tracking-wider mb-1 truncate">Range (Min/Max)</span>
                                <span class="text-sm sm:text-base font-black text-white italic leading-none">
                                    {{ Math.round(stats.m_min_total) }}m <span class="text-[9px] font-normal text-white/30">to</span> {{ Math.round(stats.m_max_total) }}m
                                </span>
                                <span class="text-[8px] font-bold text-white/30 mt-1">Extreme Cases</span>
                            </div>
                        </div>
                    </div>
                    <UIcon name="i-heroicons-bolt-solid" class="absolute -right-14 -bottom-14 w-60 h-52 text-white/5 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-1000" />
                </div>

                <!-- Strategic Analysis Panel -->
                <div class="lg:col-span-7 space-y-8">
                    <!-- Critical Alert Wall -->
                    <div class="bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-sm border border-gray-100 dark:border-gray-800 h-full flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between mb-10">
                                <div class="flex items-center gap-3">
                                    <div class="w-1.5 h-6 bg-red-500 rounded-full"></div>
                                    <h3 class="text-2xl font-black text-[#2c323f] dark:text-white uppercase italic tracking-tight">Bottleneck Detection</h3>
                                </div>
                                <div class="px-4 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-full text-[10px] font-black text-gray-400 tracking-widest border border-gray-100 dark:border-gray-700">REAL-TIME MONITOR</div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div v-for="(msg, idx) in [
                                    { cond: stats.m_total_all > 60, text: 'Total journey exceeds 60 min threshold', label: 'TARGET FAIL', color: 'red' },
                                    { cond: stats.m_wait_screen > 20, text: 'Severe congestion at Screening point', label: 'QUEUE HIGH', color: 'orange' },
                                    { cond: stats.m_wait_doc1 > 15, text: 'Critical delay for Physician assignment', label: 'DELAY', color: 'amber' },
                                    { cond: stats.m_wait_rx > 15, text: 'Medication dispensing latency high', label: 'RX WAIT', color: 'rose' }
                                ].filter(m => m.cond)" :key="idx" class="p-6 rounded-[2rem] border-2 flex flex-col gap-3 group transition-all duration-300" :class="`border-${msg.color}-100 bg-${msg.color}-50/50 hover:bg-${msg.color}-50 dark:bg-${msg.color}-950/10 dark:border-${msg.color}-900/30`">
                                    <div class="flex items-center justify-between">
                                        <div :class="`p-2 rounded-xl bg-${msg.color}-500 text-white shadow-lg shadow-${msg.color}-500/20`"><UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" /></div>
                                        <span :class="`text-[9px] font-black text-${msg.color}-500 tracking-widest uppercase`">{{ msg.label }}</span>
                                    </div>
                                    <span class="text-sm font-bold text-gray-700 dark:text-gray-300 leading-tight">{{ msg.text }}</span>
                                </div>
                                <div v-if="!(stats.m_total_all > 60 || stats.m_wait_screen > 20 || stats.m_wait_doc1 > 15 || stats.m_wait_rx > 15)" class="col-span-2 py-16 flex flex-col items-center justify-center">
                                    <div class="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
                                        <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-green-500" />
                                    </div>
                                    <p class="text-lg font-black uppercase tracking-[4px] text-green-600 dark:text-green-400">Flow Optimized</p>
                                    <p class="text-xs font-bold text-gray-400 mt-2">All service points are currently within target KPI</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="pt-8 mt-10 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-2xl bg-[#fff8e1] dark:bg-[#ba895d]/10 flex items-center justify-center">
                                    <UIcon name="i-heroicons-light-bulb" class="text-[#ba895d] text-xl" />
                                </div>
                                <div>
                                    <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Recommendation</p>
                                    <p class="text-xs font-bold text-[#ba895d] italic">{{ stats.m_wait_doc1 > 15 ? 'เพิ่มจำนวนแพทย์ตรวจในช่วงเวลาหนาแน่น' : 'รักษาระดับการบริการปัจจุบัน' }}</p>
                                </div>
                            </div>
                            <UButton label="Export Report" variant="ghost" color="gray" class="font-black text-[10px] uppercase tracking-widest" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Row 2: Steps Visualization Row -->
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
                <div v-for="step in steps" :key="step.label" 
                     @click="openDetailsModal(step)"
                     class="bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-sm border border-gray-100 dark:border-gray-800 group hover:shadow-2xl hover:shadow-[#24695c]/5 hover:-translate-y-3 cursor-pointer transition-all duration-700">
                    <div class="flex items-center justify-between mb-10">
                        <div :class="['w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-inner transition-all duration-500 group-hover:rounded-full group-hover:scale-110', step.bg, step.darkBg, step.color]">
                            <UIcon :name="step.icon" />
                        </div>
                        <div class="flex flex-col items-end text-right">
                            <span class="text-[11px] font-black text-[#24695c] dark:text-[#e0f2f1] uppercase tracking-[1px] mb-1 leading-tight">{{ step.label }}</span>
                            <UBadge v-if="step.m > 20" color="red" variant="soft" size="xs" class="font-black px-2 py-0">PEAK</UBadge>
                        </div>
                    </div>
                    <div>
                        <h4 :class="['text-4xl font-black italic tracking-tighter mb-2 transition-colors duration-500', step.color]">{{ formatMmSs(step.val) }}</h4>
                        <span class="text-[10px] font-black text-gray-400 uppercase italic tracking-widest">Minutes : Seconds</span>
                    </div>
                    <div class="mt-10 h-2 bg-[#f5f7fb] dark:bg-gray-800 rounded-full overflow-hidden p-0.5">
                        <div :class="['h-full rounded-full transition-all duration-[2000ms] ease-in-out', step.bg.replace('bg-', 'bg-').replace('-50', '-500')]" :style="{ width: getWidth(step.m, 40) }"></div>
                    </div>
                </div>
            </div>

            <!-- Analytics Breakdown Section -->
            <div class="grid grid-cols-1 gap-10">
                <!-- Waiting Time Breakdown -->
                <div class="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 relative overflow-hidden">
                    <div class="flex items-center justify-between mb-8">
                        <div class="flex items-center gap-3">
                            <div class="w-1.5 h-6 bg-[#24695c] rounded-full"></div>
                            <h3 class="text-xl font-black text-[#2c323f] dark:text-white uppercase italic tracking-tight">Waiting Time Breakdown</h3>
                        </div>
                        <UBadge color="emerald" variant="subtle" class="font-black px-3 py-1 rounded-full text-[9px] tracking-[2px]">OPERATIONAL FLOW</UBadge>
                    </div>
                    
                    <div class="space-y-6">
                        <!-- Premium Stacked Bar (Taller, cleaner, and beautiful) -->
                        <div class="relative px-1 pt-2">
                            <div class="flex h-10 rounded-[0.9rem] overflow-hidden bg-[#f5f7fb] dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-[4px] shadow-inner" style="gap: 3px;">
                                <div v-for="(step, i) in stackedBarSegments" :key="i" :style="{ width: (step.val / (stats.m_total_all || 1) * 100) + '%' }" :class="[step.color, 'h-full hover:brightness-110 transition-all duration-300 flex items-center justify-center group/seg relative cursor-help rounded-[0.6rem] first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] shadow-sm']">
                                    <span class="text-[10px] sm:text-xs font-black text-white drop-shadow-md tabular-nums">{{ Math.round(step.val / (stats.m_total_all || 1) * 100) }}%</span>
                                    
                                    <!-- Tooltip -->
                                    <div class="absolute -top-11 left-1/2 -translate-x-1/2 bg-[#2c323f] text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover/seg:opacity-100 whitespace-nowrap z-50 pointer-events-none font-bold shadow-xl border border-white/10 transition-all duration-200 scale-90 group-hover/seg:scale-100">
                                        {{ step.label }}: {{ Math.round(step.val) }} นาที
                                        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#2c323f] rotate-45 border-r border-b border-white/10"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Compact Legend Row -->
                        <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 px-1">
                            <div v-for="legend in stackedBarSegments" :key="legend.label" class="flex items-center gap-2">
                                <div :class="['w-2.5 h-2.5 rounded-full', legend.color]"></div>
                                <span class="text-[11px] font-bold text-gray-500 dark:text-gray-400">{{ legend.label }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Decorative BG -->
                    <div class="absolute -right-16 -bottom-16 w-64 h-64 bg-[#24695c]/3 rounded-full blur-3xl -z-0"></div>
                </div>
            </div>

            <!-- Row 3: Heatmaps & Traffic -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div class="lg:col-span-12 bg-white dark:bg-gray-900 rounded-[3.5rem] p-12 shadow-sm border border-gray-100 dark:border-gray-800">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16">
                        <div>
                            <h3 class="text-3xl font-black text-[#2c323f] dark:text-white uppercase italic tracking-tighter flex items-center gap-4">
                                <div class="w-1.5 h-8 bg-[#ba895d] rounded-full"></div>
                                Hourly Service Heatmaps
                            </h3>
                            <p class="text-gray-400 font-bold text-sm mt-2 pl-6">วิเคราะห์ความหนาแน่นและระยะเวลาเฉลี่ยรายชั่วโมง (05:00 - 16:00)</p>
                        </div>
                        <div class="flex gap-4">
                            <div class="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700">
                                <span class="w-2 h-2 rounded-full bg-teal-400"></span> Screening
                            </div>
                            <div class="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700">
                                <span class="w-2 h-2 rounded-full bg-[#ba895d]"></span> Physician
                            </div>
                        </div>
                    </div>

                    <div class="space-y-16">
                        <!-- Screen Wait Heatmap -->
                        <div class="relative group">
                            <div class="flex items-center mb-8">
                                <div class="w-32 shrink-0 flex flex-col">
                                    <span class="text-[11px] font-black text-[#2c323f] dark:text-white uppercase tracking-widest">Screening</span>
                                    <span class="text-[9px] font-bold text-gray-400 uppercase italic mt-1">Patient Load</span>
                                </div>
                                <div class="flex-1 flex gap-3 h-16">
                                    <div v-for="(h, idx) in displayHourlyScreen" :key="idx" class="flex-1 rounded-[1.2rem] flex items-center justify-center group/cell relative transition-all duration-500 hover:scale-110 hover:-translate-y-2 hover:shadow-xl shadow-teal-500/20" :class="getScreeningLoadClass(h.patient_count, maxPatientsScreen)">
                                        <span class="text-xs font-black">{{ h.patient_count }}</span>
                                        <div class="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#2c323f] text-white text-[10px] px-3 py-1.5 rounded-xl opacity-0 group-hover/cell:opacity-100 whitespace-nowrap z-50 pointer-events-none font-bold shadow-2xl scale-0 group-hover/cell:scale-100 transition-all">
                                            {{ h.visit_hour }}:00 | {{ h.patient_count }} Patients
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center">
                                <div class="w-32 shrink-0 text-[9px] font-bold text-gray-400 uppercase italic">Waiting Avg</div>
                                <div class="flex-1 flex gap-3 h-16">
                                    <div v-for="(h, idx) in displayHourlyScreen" :key="idx" class="flex-1 rounded-[1.2rem] flex items-center justify-center group/cell relative transition-all duration-500 hover:scale-110 hover:-translate-y-2 hover:shadow-xl shadow-red-500/20" :class="getScreeningWaitClass(h.avg_wait_minutes, h.patient_count)">
                                        <span v-if="h.patient_count > 0" class="text-[10px] font-black">{{ Math.round(h.avg_wait_minutes) }}m</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Divider -->
                        <div class="h-px bg-gray-100 dark:bg-gray-800 w-full ml-32"></div>

                        <!-- Doctor Wait Heatmap -->
                        <div class="relative group">
                            <div class="flex items-center mb-8">
                                <div class="w-32 shrink-0 flex flex-col">
                                    <span class="text-[11px] font-black text-[#2c323f] dark:text-white uppercase tracking-widest">Physician</span>
                                    <span class="text-[9px] font-bold text-gray-400 uppercase italic mt-1">Patient Load</span>
                                </div>
                                <div class="flex-1 flex gap-3 h-16">
                                    <div v-for="(h, idx) in displayHourlyDoctor" :key="idx" class="flex-1 rounded-[1.2rem] flex items-center justify-center group/cell relative transition-all duration-500 hover:scale-110 hover:-translate-y-2 hover:shadow-xl shadow-amber-500/20" :class="getPhysicianLoadClass(h.patient_count, maxPatientsDoctor)">
                                        <span class="text-xs font-black">{{ h.patient_count }}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center">
                                <div class="w-32 shrink-0 text-[9px] font-bold text-gray-400 uppercase italic">Waiting Avg</div>
                                <div class="flex-1 flex gap-3 h-16">
                                    <div v-for="(h, idx) in displayHourlyDoctor" :key="idx" class="flex-1 rounded-[1.2rem] flex items-center justify-center group/cell relative transition-all duration-500 hover:scale-110 hover:-translate-y-2 hover:shadow-xl shadow-orange-500/20" :class="getPhysicianWaitClass(h.avg_wait_minutes, h.patient_count)">
                                        <span v-if="h.patient_count > 0" class="text-[10px] font-black">{{ Math.round(h.avg_wait_minutes) }}m</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex ml-32 pl-4 pt-10">
                                <div v-for="h in timeSlots" :key="h" class="flex-1 text-center text-[11px] font-black text-[#2c323f] dark:text-gray-400 italic">{{ String(h).padStart(2, '0') }}:00</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Traffic Stats Side Panel -->
                <div class="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-10 mt-4">
                    <!-- Traffic List -->
                    <div class="bg-white dark:bg-gray-900 rounded-[3.5rem] p-12 shadow-sm border border-gray-100 dark:border-gray-800">
                        <div class="flex items-center justify-between mb-12">
                            <h3 class="text-2xl font-black text-[#2c323f] dark:text-white uppercase italic tracking-tight flex items-center gap-4">
                                <UIcon name="i-heroicons-chart-bar" class="text-[#24695c]" />
                                Traffic Profile
                            </h3>
                            <div class="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-lg">VOLUMETRIC DATA</div>
                        </div>
                        
                        <div class="space-y-6">
                            <div v-for="t in displayTraffic" :key="t.hour" class="flex items-center gap-8 group">
                                <span class="w-16 text-xs font-black text-[#2c323f] dark:text-gray-300 italic">{{ String(t.hour).padStart(2, '0') }}:00</span>
                                <div class="flex-1 h-3 bg-[#f5f7fb] dark:bg-gray-800 rounded-full overflow-hidden p-0.5 border border-white dark:border-gray-700 shadow-inner">
                                    <div class="h-full bg-gradient-to-r from-[#24695c] to-[#45b39d] rounded-full transition-all duration-[1500ms] group-hover:shadow-[0_0_10px_#45b39d]" :style="{ width: getWidth(t.total, maxTraffic) }"></div>
                                </div>
                                <span class="w-12 text-sm font-black text-[#24695c] text-right group-hover:scale-125 transition-transform">{{ t.total }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Highlight Insight -->
                    <div class="bg-gradient-to-br from-[#ba895d] to-[#8d6e63] rounded-[2.5rem] p-8 text-white shadow-2xl shadow-[#ba895d]/20 flex flex-col justify-between min-h-[420px] group overflow-hidden relative">
                        <div class="relative z-10 space-y-2">
                            <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10">
                                <span class="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#fff] animate-ping"></span>
                                <span class="text-[9px] font-black uppercase tracking-widest text-white italic">Peak Activity Insight</span>
                            </div>
                            <h3 class="text-2xl font-black italic tracking-tighter leading-tight">Daily Traffic Max Intensity</h3>
                            <p class="text-white/70 text-xs font-bold leading-normal">วิเคราะห์ช่วงเวลาที่มีการลงทะเบียนหนาแน่นสูงและคอขวดที่เกิดขึ้นจริง</p>
                        </div>
                        
                        <!-- Mini analytics grid inside Peak card -->
                        <div class="relative z-10 grid grid-cols-2 gap-4 border-t border-white/15 pt-4">
                            <div>
                                <span class="text-[9px] font-black text-white/55 uppercase tracking-wider block mb-1">Peak Time Slot</span>
                                <div v-if="busiestHour" class="text-xl sm:text-2xl font-black italic leading-none">
                                    {{ String(busiestHour.hour).padStart(2, '0') }}:00 - {{ String(busiestHour.hour + 1).padStart(2, '0') }}:00
                                </div>
                                <div v-else class="text-lg font-black italic leading-none">No Peak Data</div>
                                <span class="text-[9px] font-bold text-[#fff8e1] block mt-1">หนาแน่นเป็น <strong class="text-base font-black italic underline">{{ peakVsNormalRatio }}x</strong> เท่าของปกติ</span>
                            </div>
                            
                            <div class="border-l border-white/15 pl-4 flex flex-col justify-between">
                                <div>
                                    <span class="text-[9px] font-black text-white/55 uppercase tracking-wider block mb-1">Peak Load Volume</span>
                                    <span class="text-xl sm:text-2xl font-black italic leading-none">{{ busiestHour ? busiestHour.total : 0 }} <span class="text-xs font-normal text-white/50">Cases</span></span>
                                </div>
                                <div class="text-[9px] font-black text-[#fff8e1] flex items-center gap-1 mt-1.5 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 w-fit max-w-full">
                                    <UIcon name="i-heroicons-exclamation-triangle" class="shrink-0 text-amber-300" />
                                    <span class="truncate" :title="peakHourBottleneck || 'ไม่มีข้อมูลจุดหน่วง'">{{ peakHourBottleneck || 'ไม่มีข้อมูลจุดหน่วง' }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Actionable Recommendation for hospital executives (Fills the blank space beautifully) -->
                        <div class="relative z-10 bg-black/20 p-4 rounded-2xl border border-white/5 mt-4 text-xs flex gap-3">
                            <div class="p-2 rounded-xl bg-white/10 text-white shrink-0 self-start"><UIcon name="i-heroicons-light-bulb" class="w-5 h-5 text-amber-300" /></div>
                            <div class="space-y-1">
                                <span class="text-[9px] font-black text-white/55 uppercase tracking-widest block">Executive Recommendation</span>
                                <p class="font-medium text-white/95 leading-relaxed">
                                    ชั่วโมงพีคมีโหลดงานหนาแน่นกว่าชั่วโมงปกติถึง <span class="font-bold underline text-amber-300">{{ peakVsNormalRatio }} เท่า</span> 
                                    แนะนำสลับบุคลากรสนับสนุนที่จุด <span class="font-bold underline text-amber-200">{{ peakHourBottleneck ? peakHourBottleneck.split(' (')[0] : 'คัดกรอง' }}</span> 
                                    เพื่อบริหารระยะเวลารอคอยให้ลื่นไหลตามเกณฑ์เป้าหมาย
                                </p>
                            </div>
                        </div>

                        <!-- Abstract background -->
                        <div class="absolute -right-10 top-1/2 -translate-y-1/2 w-48 h-48 border-[20px] border-white/5 rounded-full scale-150 group-hover:scale-[1.75] transition-transform duration-1000"></div>
                        <UIcon name="i-heroicons-bolt-solid" class="absolute -right-6 -bottom-6 w-32 h-32 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State Improved -->
        <div v-else-if="status !== 'pending'" class="py-40 flex flex-col items-center justify-center bg-white dark:bg-gray-900 rounded-[4rem] border-4 border-dashed border-gray-100 dark:border-gray-800 group">
            <div class="w-32 h-32 bg-gray-50 dark:bg-gray-800 rounded-[2.5rem] flex items-center justify-center text-gray-200 dark:text-gray-700 mb-10 group-hover:rotate-12 transition-transform duration-700">
                <UIcon name="i-heroicons-calendar-days" class="text-6xl" />
            </div>
            <h3 class="text-2xl font-black text-gray-400 uppercase tracking-[0.3em] italic">No Analytics Available</h3>
            <p class="text-gray-300 font-bold text-sm mt-4 uppercase">Target Range: {{ startDate }} &rarr; {{ endDate }}</p>
            <UButton 
                label="Reset Time Filter" 
                variant="outline" 
                class="mt-12 font-black text-[#24695c] border-[#24695c] hover:bg-[#24695c] hover:text-white px-10 py-4 rounded-2xl transition-all" 
                @click="startDate = today; endDate = today;"
            />
        </div>
        
        <!-- Premium Loading State -->
        <div v-if="status === 'pending'" class="fixed inset-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl z-50 flex items-center justify-center">
            <div class="flex flex-col items-center">
                <div class="relative w-24 h-24 mb-8">
                    <div class="absolute inset-0 border-8 border-[#24695c]/20 rounded-full"></div>
                    <div class="absolute inset-0 border-8 border-[#24695c] border-t-transparent rounded-full animate-spin"></div>
                    <div class="absolute inset-4 border-4 border-[#ba895d]/30 border-b-transparent rounded-full animate-[spin_2s_linear_infinite]"></div>
                </div>
                <p class="text-[#2c323f] dark:text-white font-black uppercase tracking-[6px] text-xs mb-2">Analyzing HOSxP Metrics</p>
                <p class="text-[#24695c] text-[10px] font-bold uppercase tracking-widest animate-pulse italic">Computational Insight Generation...</p>
            </div>
        </div>

        <!-- Details Modal -->
        <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-md" @click="isModalOpen = false"></div>
            
            <!-- Modal Box -->
            <div class="relative bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200">
                <!-- Header -->
                <div class="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <h3 class="text-2xl font-black text-[#2c323f] dark:text-white uppercase italic tracking-tight flex items-center gap-3">
                            <span class="w-1.5 h-6 bg-[#24695c] rounded-full"></span>
                            รายชื่อผู้ป่วย: {{ activeStepLabel }}
                        </h3>
                        <p class="text-xs font-bold text-gray-400 mt-1 uppercase">ข้อมูลงวดวันที่ {{ startDate }} ถึง {{ endDate }}</p>
                    </div>
                    
                    <button @click="isModalOpen = false" class="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors">
                        <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
                    </button>
                </div>
                
                <!-- Quick Stats inside Modal -->
                <div class="px-8 py-4 bg-[#f5f7fb] dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                        <span class="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-0.5">Total Cases</span>
                        <span class="text-xl font-black text-[#24695c] dark:text-[#2dd4bf] italic">{{ modalVisits.length }} ราย</span>
                    </div>
                    <div>
                        <span class="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-0.5">Average Time</span>
                        <span class="text-xl font-black text-gray-700 dark:text-white italic">{{ Math.round(modalStats.average) }} นาที</span>
                    </div>
                    <div>
                        <span class="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-0.5">Max Time</span>
                        <span class="text-xl font-black text-red-500 dark:text-rose-400 italic">{{ Math.round(modalStats.max) }} นาที</span>
                    </div>
                    <div>
                        <span class="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-0.5">SLA Target</span>
                        <span class="text-xl font-black text-amber-600 dark:text-amber-400 italic">&le; {{ getKpiThreshold(activeStepKey) }} นาที</span>
                    </div>
                </div>

                <!-- Search and Filters -->
                <div class="p-8 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="relative flex-1 max-w-md">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                            <UIcon name="i-heroicons-magnifying-glass" class="w-5 h-5" />
                        </span>
                        <input v-model="searchQuery" type="text" placeholder="ค้นหาเลขที่ลงทะเบียน (VN)..." class="w-full pl-10 pr-4 py-2.5 bg-[#f5f7fb] dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-white focus:outline-none focus:border-[#24695c] focus:ring-1 focus:ring-[#24695c] placeholder-gray-400" />
                    </div>
                    <div class="flex items-center gap-3">
                        <UButton icon="i-heroicons-arrow-down-tray" size="sm" color="teal" variant="soft" class="font-black text-[10px] uppercase tracking-wider rounded-xl py-2.5 px-4" @click="exportToCSV">
                            Export CSV
                        </UButton>
                    </div>
                </div>

                <!-- Table Content -->
                <div class="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="border-b border-gray-100 dark:border-gray-800">
                                <th class="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest w-12">#</th>
                                <th class="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">VN (เลขทะเบียน)</th>
                                <th class="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">HN</th>
                                <th class="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">วันที่รับบริการ</th>
                                <th class="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest">เวลาคิว</th>
                                <th class="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">เวลาดำเนินการ (นาที)</th>
                                <th class="pb-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(v, index) in modalVisits" :key="v.vn" class="border-b border-gray-55 dark:border-gray-800/50 hover:bg-[#f5f7fb]/40 dark:hover:bg-gray-800/20 transition-colors">
                                <td class="py-4 text-xs font-bold text-gray-400 tabular-nums">{{ index + 1 }}</td>
                                <td class="py-4 text-xs font-black text-[#24695c] dark:text-[#2dd4bf] hover:underline cursor-pointer tabular-nums" @click="openVnDetails(v.vn)">
                                    {{ v.vn }}
                                </td>
                                <td class="py-4 text-xs font-bold text-gray-700 dark:text-gray-300 tabular-nums">
                                    {{ v.hn }}
                                </td>
                                <td class="py-4 text-xs font-bold text-gray-500 dark:text-gray-400">{{ v.vstdate }}</td>
                                <td class="py-4 text-xs font-bold text-gray-500 dark:text-gray-400 tabular-nums">{{ v.vsttime }}</td>
                                <td class="py-4 text-xs font-black text-right tabular-nums" :class="v.value > getKpiThreshold(activeStepKey) ? 'text-red-500 dark:text-rose-400' : 'text-green-500 dark:text-emerald-400'">
                                    {{ Math.round(v.value) }} นาที
                                </td>
                                <td class="py-4 text-center">
                                    <span v-if="v.value > getKpiThreshold(activeStepKey)" class="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/20 text-[9px] font-black text-red-500 uppercase tracking-wider">FAIL</span>
                                    <span v-else class="px-2 py-0.5 rounded-md bg-green-50 dark:bg-green-950/20 text-[9px] font-black text-green-500 uppercase tracking-wider">PASS</span>
                                </td>
                            </tr>
                            <tr v-if="modalVisits.length === 0">
                                <td colspan="7" class="py-12 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    ไม่พบข้อมูลผู้ป่วยสำหรับรายการนี้
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Patient VN Timeline Modal -->
        <div v-if="isVnModalOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-md" @click="isVnModalOpen = false"></div>
            
            <!-- Modal Box -->
            <div class="relative bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200">
                <!-- Header -->
                <div class="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <h3 class="text-xl font-black text-[#2c323f] dark:text-white uppercase italic tracking-tight flex items-center gap-3">
                            <span class="w-1.5 h-6 bg-[#ba895d] rounded-full"></span>
                            Timeline ผู้ป่วย: {{ selectedVn }}
                        </h3>
                        <p class="text-xs font-bold text-gray-400 mt-1 uppercase">HN: {{ selectedVnDetailsData?.hn || '-' }} | เลขที่ลงทะเบียนผู้ป่วยนอก (OPD VN)</p>
                    </div>
                    
                    <button @click="isVnModalOpen = false" class="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors">
                        <UIcon name="i-heroicons-x-mark" class="w-6 h-6" />
                    </button>
                </div>
                
                <!-- Timeline Content -->
                <div class="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
                    <!-- Loading State -->
                    <div v-if="isVnLoading" class="py-20 flex flex-col items-center justify-center">
                        <div class="w-12 h-12 border-4 border-[#24695c] border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p class="text-sm font-bold text-gray-500 dark:text-gray-400">กำลังดึงข้อมูลขั้นตอนบริการจาก HOSxP...</p>
                    </div>
                    
                    <!-- Not Found State -->
                    <div v-else-if="!selectedVnDetailsData" class="py-20 flex flex-col items-center justify-center text-center">
                        <UIcon name="i-heroicons-exclamation-triangle" class="text-4xl text-rose-500 mb-4" />
                        <p class="text-sm font-black text-gray-700 dark:text-white">ไม่พบข้อมูลขั้นตอนของ VN นี้</p>
                        <p class="text-xs font-bold text-gray-400 mt-2 max-w-xs">โปรดตรวจสอบว่าระบุหมายเลขถูกต้อง หรือผู้ป่วยมีการเข้าสู่กระบวนการที่จุดบริการหลักครบถ้วนหรือไม่</p>
                    </div>

                    <!-- Timeline Content Ready -->
                    <template v-else>
                        <div class="flex justify-between items-center bg-[#f5f7fb] dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 text-xs font-bold">
                            <span class="text-gray-400">วันที่รับบริการ: {{ selectedVnDetailsData.vstdate }}</span>
                            <span class="text-gray-400">เวลาคิว: {{ selectedVnDetailsData.vsttime }}</span>
                        </div>

                        <!-- Timeline Steps -->
                        <div class="relative pl-8 border-l-2 border-gray-100 dark:border-gray-800 ml-4 space-y-8 py-2">
                            
                            <!-- Step 1: ลงทะเบียน -->
                            <div class="relative">
                                <span class="absolute -left-[41px] top-0.5 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-black text-gray-500">1</span>
                                <div>
                                    <h4 class="text-sm font-black text-[#2c323f] dark:text-white">ลงทะเบียนผู้ป่วยนอกเสร็จสิ้น</h4>
                                    <p class="text-[11px] font-bold text-gray-400 mt-0.5">เวลา: {{ selectedVnDetailsData.reg_end_dt ? selectedVnDetailsData.reg_end_dt.split(' ')[1] : '-' }}</p>
                                </div>
                            </div>

                            <!-- Transition 1: รอซักประวัติ -->
                            <div class="bg-teal-50/50 dark:bg-teal-950/10 border border-teal-100/30 dark:border-teal-900/20 p-3 rounded-xl flex items-center justify-between text-xs">
                                <span class="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                                    <UIcon name="i-heroicons-clock" /> รอซักประวัติ
                                </span>
                                <span class="font-black text-[#2c323f] dark:text-white tabular-nums">
                                    {{ selectedVnDetailsData.wait_screen_m !== null ? Math.round(safeNum(selectedVnDetailsData.wait_screen_m)) + ' นาที' : '-' }}
                                </span>
                            </div>

                            <!-- Step 2: ซักประวัติ -->
                            <div class="relative">
                                <span class="absolute -left-[41px] top-0.5 w-6 h-6 rounded-full bg-teal-500 border-4 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-teal-500/20">2</span>
                                <div>
                                    <h4 class="text-sm font-black text-[#2c323f] dark:text-white">ซักประวัติ / คัดกรอง</h4>
                                    <p class="text-[11px] font-bold text-gray-400 mt-0.5">
                                        เริ่ม: {{ selectedVnDetailsData.screen_begin_dt ? selectedVnDetailsData.screen_begin_dt.split(' ')[1] : '-' }} &rarr; 
                                        เสร็จ: {{ selectedVnDetailsData.screen_end_dt ? selectedVnDetailsData.screen_end_dt.split(' ')[1] : '-' }}
                                    </p>
                                    <p class="text-[11px] font-bold text-teal-600 dark:text-teal-400 mt-1">
                                        ระยะเวลาให้บริการ: {{ selectedVnDetailsData.screen_m !== null && selectedVnDetailsData.screen_m !== undefined ? Math.round(safeNum(selectedVnDetailsData.screen_m)) + ' นาที' : '-' }}
                                    </p>
                                </div>
                            </div>

                            <!-- Transition 2: รอพบแพทย์ -->
                            <div class="bg-[#fff8e1]/60 dark:bg-[#ba895d]/10 border border-[#fff8e1] dark:border-[#ba895d]/20 p-3 rounded-xl flex items-center justify-between text-xs">
                                <span class="font-bold text-[#ba895d] flex items-center gap-1">
                                    <UIcon name="i-heroicons-clock" /> รอพบแพทย์
                                </span>
                                <span class="font-black text-[#2c323f] dark:text-white tabular-nums">
                                    {{ selectedVnDetailsData.wait_doctor_m !== null ? Math.round(safeNum(selectedVnDetailsData.wait_doctor_m)) + ' นาที' : '-' }}
                                </span>
                            </div>

                            <!-- Step 3: แพทย์ตรวจ -->
                            <div class="relative">
                                <span class="absolute -left-[41px] top-0.5 w-6 h-6 rounded-full bg-green-500 border-4 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-green-500/20">3</span>
                                <div>
                                    <h4 class="text-sm font-black text-[#2c323f] dark:text-white">แพทย์ตรวจวินิจฉัย</h4>
                                    <p class="text-[11px] font-bold text-gray-400 mt-0.5">
                                        เริ่ม: {{ selectedVnDetailsData.doc_begin_dt ? selectedVnDetailsData.doc_begin_dt.split(' ')[1] : '-' }} &rarr; 
                                        เสร็จ: {{ selectedVnDetailsData.doc_end_dt ? selectedVnDetailsData.doc_end_dt.split(' ')[1] : '-' }}
                                    </p>
                                    <p class="text-[11px] font-bold text-green-600 dark:text-green-400 mt-1">
                                        ระยะเวลาให้บริการ: {{ selectedVnDetailsData.doctor_m !== null && selectedVnDetailsData.doctor_m !== undefined ? Math.round(safeNum(selectedVnDetailsData.doctor_m)) + ' นาที' : '-' }}
                                    </p>
                                </div>
                            </div>

                            <!-- Transition 3 & Step 3.5/4 conditional on having post-doc data -->
                            <template v-if="selectedVnDetailsData.wait_post_doc_m !== null || selectedVnDetailsData.post_doc_m !== null">
                                <!-- Transition 3a: รอหลังพบแพทย์ -->
                                <div class="bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 p-3 rounded-xl flex items-center justify-between text-xs">
                                    <span class="font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                        <UIcon name="i-heroicons-clock" /> รอหลังพบแพทย์ (ห้อง 042)
                                    </span>
                                    <span class="font-black text-[#2c323f] dark:text-white tabular-nums">
                                        {{ selectedVnDetailsData.wait_post_doc_m !== null ? Math.round(safeNum(selectedVnDetailsData.wait_post_doc_m)) + ' นาที' : '-' }}
                                    </span>
                                </div>

                                <!-- Step 3.5: บริการหลังพบแพทย์ -->
                                <div class="relative">
                                    <span class="absolute -left-[41px] top-0.5 w-6 h-6 rounded-full bg-purple-500 border-4 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-purple-500/20">3.5</span>
                                    <div>
                                        <h4 class="text-sm font-black text-[#2c323f] dark:text-white">บริการหลังพบแพทย์ (ออกใบนัด / ให้คำแนะนำ)</h4>
                                        <p class="text-[11px] font-bold text-gray-400 mt-0.5">
                                            เริ่ม: {{ selectedVnDetailsData.post_doc_begin_dt ? selectedVnDetailsData.post_doc_begin_dt.split(' ')[1] : '-' }} &rarr; 
                                            เสร็จ: {{ selectedVnDetailsData.post_doc_end_dt ? selectedVnDetailsData.post_doc_end_dt.split(' ')[1] : '-' }}
                                        </p>
                                        <p class="text-[11px] font-bold text-purple-600 dark:text-purple-400 mt-1">
                                            ระยะเวลาให้บริการ: {{ selectedVnDetailsData.post_doc_m !== null && selectedVnDetailsData.post_doc_m !== undefined ? Math.round(safeNum(selectedVnDetailsData.post_doc_m)) + ' นาที' : '-' }}
                                        </p>
                                    </div>
                                </div>

                                <!-- Transition 3b: รอรับยา (จริง) -->
                                <div class="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100/30 dark:border-orange-900/20 p-3 rounded-xl flex items-center justify-between text-xs">
                                    <span class="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                        <UIcon name="i-heroicons-clock" /> รอรับยา
                                    </span>
                                    <span class="font-black text-[#2c323f] dark:text-white tabular-nums">
                                        {{ selectedVnDetailsData.wait_drug_m !== null ? Math.round(safeNum(selectedVnDetailsData.wait_drug_m)) + ' นาที' : '-' }}
                                    </span>
                                </div>

                                <!-- Step 4: รับยาเสร็จสิ้น -->
                                <div class="relative">
                                    <span class="absolute -left-[41px] top-0.5 w-6 h-6 rounded-full bg-orange-500 border-4 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-orange-500/20">4</span>
                                    <div>
                                        <h4 class="text-sm font-black text-[#2c323f] dark:text-white">รับยาและเสร็จสิ้นบริการ</h4>
                                        <p class="text-[11px] font-bold text-gray-400 mt-0.5">เวลาจ่ายเสร็จสิ้น: {{ selectedVnDetailsData.rx_dispense_dt ? selectedVnDetailsData.rx_dispense_dt.split(' ')[1] : '-' }}</p>
                                    </div>
                                </div>
                            </template>

                            <template v-else>
                                <!-- Transition 3: รอรับยา -->
                                <div class="bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100/30 dark:border-orange-900/20 p-3 rounded-xl flex items-center justify-between text-xs">
                                    <span class="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                        <UIcon name="i-heroicons-clock" /> รอใบนัด/รอรับยา
                                    </span>
                                    <span class="font-black text-[#2c323f] dark:text-white tabular-nums">
                                        {{ selectedVnDetailsData.wait_drug_m !== null ? Math.round(safeNum(selectedVnDetailsData.wait_drug_m)) + ' นาที' : '-' }}
                                    </span>
                                </div>

                                <!-- Step 4: รับยาเสร็จสิ้น -->
                                <div class="relative">
                                    <span class="absolute -left-[41px] top-0.5 w-6 h-6 rounded-full bg-orange-500 border-4 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-orange-500/20">4</span>
                                    <div>
                                        <h4 class="text-sm font-black text-[#2c323f] dark:text-white">รับยาและเสร็จสิ้นบริการ</h4>
                                        <p class="text-[11px] font-bold text-gray-400 mt-0.5">เวลาจ่ายเสร็จสิ้น: {{ selectedVnDetailsData.rx_dispense_dt ? selectedVnDetailsData.rx_dispense_dt.split(' ')[1] : '-' }}</p>
                                    </div>
                                </div>
                            </template>

                        </div>

                        <!-- Doctor Signatures section -->
                        <div v-if="selectedVnDoctorSigns && selectedVnDoctorSigns.length > 0" class="space-y-4 pt-6 border-t border-gray-150 dark:border-gray-800">
                            <h4 class="text-xs font-black text-[#ba895d] uppercase tracking-wider flex items-center gap-2">
                                <UIcon name="i-heroicons-pencil-square" class="text-base" />
                                การลงลายมือชื่อแพทย์ (Doctor Signatures)
                            </h4>
                            <div class="space-y-3">
                                <div v-for="(ds, idx) in selectedVnDoctorSigns" :key="idx" class="bg-[#f5f7fb]/60 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 p-4 rounded-[1.2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-full bg-[#ba895d]/10 flex items-center justify-center text-[#ba895d] shrink-0">
                                            <UIcon name="i-heroicons-user" class="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p class="font-black text-[#2c323f] dark:text-white">{{ ds.doctor_name || 'ไม่ระบุชื่อแพทย์' }}</p>
                                            <p class="text-[10px] font-bold text-gray-400 mt-0.5">{{ ds.department_name || 'ไม่ระบุแผนก' }}</p>
                                        </div>
                                    </div>
                                    <span class="font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-1 rounded-xl border border-gray-100 dark:border-gray-700/80 tabular-nums self-end sm:self-center">
                                        {{ ds.sign_datetime ? ds.sign_datetime.split(' ')[1] : '-' }} น.
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Total Journey Footer -->
                        <div class="bg-gradient-to-br from-[#2c323f] to-[#1a1a2e] text-white p-5 rounded-2xl flex items-center justify-between shadow-xl">
                            <span class="text-xs font-black uppercase tracking-wider text-white/55">เวลารวมทั้งหมดใน รพ.</span>
                            <span class="text-2xl font-black italic tabular-nums">
                                {{ Math.round(safeNum(selectedVnDetailsData.wait_screen_m) + safeNum(selectedVnDetailsData.screen_m) + safeNum(selectedVnDetailsData.wait_doctor_m) + safeNum(selectedVnDetailsData.doctor_m) + safeNum(selectedVnDetailsData.wait_drug_m)) }} นาที
                            </span>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 10px;
}
</style>
