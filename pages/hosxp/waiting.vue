<script setup lang="ts">
const today = new Date().toISOString().split('T')[0];
const startDate = ref(today);
const endDate = ref(today);

// การสลับช่วงเวลาสำหรับใช้วิเคราะห์ปัญหา (ดีฟอลต์เป็น standard 08:00 - 16:00)
const analysisPeriod = ref('standard'); // 'standard' | 'early'
const startTime = computed(() => analysisPeriod.value === 'early' ? '05:00:00' : '08:00:00');
const endTime = computed(() => '16:00:00');

// 4 ตัวกรอง Reactive อัจฉริยะสำหรับคัดกรองข้อมูลสถิติ HOSxP (เริ่มต้นเป็น false เพื่อให้โหลดข้อมูลทั้งหมดก่อนเมื่อเข้าครั้งแรก)
const excludeWeekends = ref(false);
const excludeAppointed = ref(false);
const excludeLab = ref(false);
const excludeXray = ref(false);

const { data: response, refresh, status } = await useAsyncData('waiting_stats', () => $fetch('/api/hosxp/waiting-time', {
    params: { 
        startDate: startDate.value, 
        endDate: endDate.value,
        startTime: startTime.value,
        endTime: endTime.value,
        excludeWeekends: excludeWeekends.value,
        excludeAppointed: excludeAppointed.value,
        excludeLab: excludeLab.value,
        excludeXray: excludeXray.value
    }
}), {
    watch: [startDate, endDate, startTime, endTime, excludeWeekends, excludeAppointed, excludeLab, excludeXray]
});

const rawVisits = computed(() => response.value?.visits || []);

// กรองรายเคสผู้ป่วยแบบ Reactive ฝั่งไคลเอนต์ (ตอบสนองไว 0ms)
const filteredVisits = computed(() => {
    return filterVisits(rawVisits.value, {
        excludeWeekends: excludeWeekends.value,
        excludeAppointed: excludeAppointed.value,
        excludeLab: excludeLab.value,
        excludeXray: excludeXray.value
    });
});

const getWidth = (val: number, max: number) => Math.min(100, (val / (max || 1)) * 100) + '%';

// ช็อตช่วงเวลาสำหรับการทำงาน
const timeSlots = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

// คำนวณสดในเบราว์เซอร์จากผู้ป่วยที่คัดแยกแล้ว
const displayHourlyScreen = computed(() => calculateHourlyScreen(filteredVisits.value, timeSlots));
const displayHourlyDoctor = computed(() => calculateHourlyDoctor(filteredVisits.value, timeSlots));
const displayTraffic = computed(() => calculateTraffic(filteredVisits.value, timeSlots));
const stats = computed(() => calculateStats(filteredVisits.value));

// ตัวจัดทริกเกอร์เลือกทั้งหมด / ล้างทั้งหมด
const setAllFilters = (val: boolean) => {
    excludeWeekends.value = val;
    excludeAppointed.value = val;
    excludeLab.value = val;
    excludeXray.value = val;
};

const maxPatientsScreen = computed(() => Math.max(...displayHourlyScreen.value.map(h => h.patient_count), 10));
const maxPatientsDoctor = computed(() => Math.max(...displayHourlyDoctor.value.map(h => h.patient_count), 10));
const maxTraffic = computed(() => Math.max(...displayTraffic.value.map(t => t.total || 0), 10));

const busiestHour = computed(() => {
    if (!displayTraffic.value.length) return null;
    const sorted = [...displayTraffic.value].sort((a, b) => (b.total || 0) - (a.total || 0));
    return sorted[0].total > 0 ? sorted[0] : null;
});

const steps = computed(() => [
    { label: 'รอซักประวัติ', val: stats.value?.รอซักประวัติ, m: stats.value?.m_wait_screen, color: 'text-teal-500', bg: 'bg-teal-50', darkBg: 'dark:bg-teal-900/20', icon: 'i-heroicons-user-plus' },
    { label: 'ซักประวัติ', val: stats.value?.ซักประวัติ, m: stats.value?.m_screen, color: 'text-blue-500', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20', icon: 'i-heroicons-pencil-square' },
    { label: 'รอพบแพทย์', val: stats.value?.รอตรวจ1, m: stats.value?.m_wait_doc1, color: 'text-[#ba895d]', bg: 'bg-[#fff8e1]', darkBg: 'dark:bg-[#ba895d]/10', icon: 'i-heroicons-user-group' },
    { label: 'แพทย์ตรวจ', val: stats.value?.แพทย์ตรวจ, m: stats.value?.m_doc_time, color: 'text-green-500', bg: 'bg-green-50', darkBg: 'dark:bg-green-900/20', icon: 'i-heroicons-shield-check' },
    { label: 'รอรับยา/บริการ', val: stats.value?.รอรับยา, m: stats.value?.m_wait_rx, color: 'text-orange-500', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/20', icon: 'i-heroicons-beaker' }
]);

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
    return (stats.value.m_screen || 0) + (stats.value.m_doc_time || 0);
});

const idleWaitingTime = computed(() => {
    if (!stats.value) return 0;
    return (stats.value.m_wait_screen || 0) + (stats.value.m_wait_doc1 || 0) + (stats.value.m_wait_rx || 0);
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
                    </select>
                </div>
                <UButton 
                    icon="i-heroicons-arrow-path" 
                    @click="refresh" 
                    :loading="status === 'pending'"
                    class="bg-[#24695c] hover:bg-[#1a4d43] text-white rounded-2xl px-8 font-black shadow-xl shadow-[#24695c]/30 h-14 justify-center"
                >
                    ANALYZE
                </UButton>
            </div>
            
            <!-- Decorative background elements -->
            <div class="absolute -right-20 -top-20 w-80 h-80 bg-[#24695c]/5 rounded-full blur-3xl"></div>
            <div class="absolute -left-20 -bottom-20 w-64 h-64 bg-[#ba895d]/5 rounded-full blur-3xl"></div>
        </div>

        <!-- Dynamic Analytics Filters Panel -->
        <div class="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 space-y-6">
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
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <UCheckbox v-model="excludeWeekends" label="กรองจันทร์ - ศุกร์" />
                <UCheckbox v-model="excludeAppointed" label="ไม่เอาเคสผู้ป่วยนัด" />
                <UCheckbox v-model="excludeLab" label="ไม่เอาเคสส่ง Lab" />
                <UCheckbox v-model="excludeXray" label="ไม่เอาเคสส่ง X-Ray" />
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
                <div v-for="step in steps" :key="step.label" class="bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-sm border border-gray-100 dark:border-gray-800 group hover:shadow-2xl hover:shadow-[#24695c]/5 hover:-translate-y-3 transition-all duration-700">
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
                                <div v-for="(step, i) in [
                                    { val: stats.m_wait_screen, color: 'bg-teal-400', label: 'รอซักประวัติ' },
                                    { val: stats.m_screen, color: 'bg-blue-400', label: 'ซักประวัติ' },
                                    { val: stats.m_wait_doc1, color: 'bg-[#ba895d]', label: 'รอพบแพทย์' },
                                    { val: stats.m_doc_time, color: 'bg-green-400', label: 'แพทย์ตรวจ' },
                                    { val: stats.m_wait_rx, color: 'bg-orange-400', label: 'รอรับยา/บริการ' }
                                ]" :key="i" :style="{ width: (step.val / stats.m_total_all * 100) + '%' }" :class="[step.color, 'h-full hover:brightness-110 transition-all duration-300 flex items-center justify-center group/seg relative cursor-help rounded-[0.6rem] first:rounded-l-[0.6rem] last:rounded-r-[0.6rem] shadow-sm']">
                                    <span class="text-[10px] sm:text-xs font-black text-white drop-shadow-md tabular-nums">{{ Math.round(step.val / stats.m_total_all * 100) }}%</span>
                                    
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
                            <div v-for="legend in [
                                { color: 'bg-teal-400', label: 'รอซักประวัติ' },
                                { color: 'bg-blue-400', label: 'ซักประวัติ' },
                                { color: 'bg-[#ba895d]', label: 'รอพบแพทย์' },
                                { color: 'bg-green-400', label: 'แพทย์ตรวจ' },
                                { color: 'bg-orange-400', label: 'รอรับยา/บริการ' }
                            ]" :key="legend.label" class="flex items-center gap-2">
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
                                    <div v-for="(h, idx) in displayHourlyScreen" :key="idx" class="flex-1 rounded-[1.2rem] flex items-center justify-center group/cell relative transition-all duration-500 hover:scale-110 hover:-translate-y-2 hover:shadow-xl shadow-teal-500/20" :style="{ backgroundColor: h.patient_count === 0 ? '#f5f7fb' : h.patient_count > (maxPatientsScreen * 0.7) ? '#f87171' : '#2dd4bf' }">
                                        <span class="text-xs font-black" :class="h.patient_count === 0 ? 'text-gray-200' : 'text-white'">{{ h.patient_count }}</span>
                                        <div class="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#2c323f] text-white text-[10px] px-3 py-1.5 rounded-xl opacity-0 group-hover/cell:opacity-100 whitespace-nowrap z-50 pointer-events-none font-bold shadow-2xl scale-0 group-hover/cell:scale-100 transition-all">
                                            {{ h.visit_hour }}:00 | {{ h.patient_count }} Patients
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center">
                                <div class="w-32 shrink-0 text-[9px] font-bold text-gray-400 uppercase italic">Waiting Avg</div>
                                <div class="flex-1 flex gap-3 h-16">
                                    <div v-for="(h, idx) in displayHourlyScreen" :key="idx" class="flex-1 rounded-[1.2rem] flex items-center justify-center group/cell relative transition-all duration-500 hover:scale-110 hover:-translate-y-2 hover:shadow-xl shadow-red-500/20" :style="{ backgroundColor: h.patient_count === 0 ? '#f5f7fb' : h.avg_wait_minutes > 30 ? '#ef4444' : '#14b8a6' }">
                                        <span v-if="h.patient_count > 0" class="text-[10px] font-black text-white">{{ Math.round(h.avg_wait_minutes) }}m</span>
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
                                    <div v-for="(h, idx) in displayHourlyDoctor" :key="idx" class="flex-1 rounded-[1.2rem] flex items-center justify-center group/cell relative transition-all duration-500 hover:scale-110 hover:-translate-y-2 hover:shadow-xl shadow-amber-500/20" :style="{ backgroundColor: h.patient_count === 0 ? '#f5f7fb' : h.patient_count > (maxPatientsDoctor * 0.7) ? '#fbbf24' : '#ba895d' }">
                                        <span class="text-xs font-black" :class="h.patient_count === 0 ? 'text-gray-200' : 'text-white'">{{ h.patient_count }}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center">
                                <div class="w-32 shrink-0 text-[9px] font-bold text-gray-400 uppercase italic">Waiting Avg</div>
                                <div class="flex-1 flex gap-3 h-16">
                                    <div v-for="(h, idx) in displayHourlyDoctor" :key="idx" class="flex-1 rounded-[1.2rem] flex items-center justify-center group/cell relative transition-all duration-500 hover:scale-110 hover:-translate-y-2 hover:shadow-xl shadow-orange-500/20" :style="{ backgroundColor: h.patient_count === 0 ? '#f5f7fb' : h.avg_wait_minutes > 40 ? '#f97316' : '#ba895d' }">
                                        <span v-if="h.patient_count > 0" class="text-[10px] font-black text-white">{{ Math.round(h.avg_wait_minutes) }}m</span>
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
