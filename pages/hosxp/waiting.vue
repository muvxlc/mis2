<script setup lang="ts">
const today = new Date().toISOString().split('T')[0];
const startDate = ref(today);
const endDate = ref(today);
const { data: response, refresh, status } = await useAsyncData('waiting_stats', () => $fetch('/api/hosxp/waiting-time', {
    params: { startDate: startDate.value, endDate: endDate.value }
}), {
    watch: [startDate, endDate]
});

const stats = computed(() => response.value?.stats);
const hourlyScreen = computed(() => response.value?.hourly_screen || []);
const hourlyDoctor = computed(() => response.value?.hourly_doctor || []);
const traffic = computed(() => response.value?.traffic || []);

const formatMmSs = (hms: string | null) => {
    if (!hms) return '00:00';
    const parts = hms.split(':');
    if (parts.length < 3) return hms;
    const h = parseInt(parts[0] || '0');
    const m = parseInt(parts[1] || '0');
    const s = parseInt(parts[2] || '0');
    const totalM = (h * 60) + m;
    return `${totalM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const getWidth = (val: number, max: number) => Math.min(100, (val / max) * 100) + '%';

// Time slots 08:00 - 16:00
const timeSlots = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const mapToSlots = (data: any[], key: string) => {
    return timeSlots.map(hour => {
        const found = data.find(d => parseInt(d[key]) === hour);
        return found || { [key]: hour, patient_count: 0, avg_wait_minutes: 0 };
    });
};

const displayTraffic = computed(() => mapToSlots(traffic.value, 'hour'));
const maxTraffic = computed(() => Math.max(...displayTraffic.value.map(t => t.total || 0), 10));
</script>

<template>
    <div class="space-y-8 font-thai">
        <!-- Header -->
        <header class="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
                <h1 class="text-3xl font-bold tracking-tight text-[#2c323f] dark:text-white flex items-center gap-3">
                    <UIcon name="i-heroicons-clock" class="text-[#24695c]" />
                    ระยะเวลารอคอย (Waiting Time)
                </h1>
                <p class="text-gray-400 mt-1">สรุปสถิติเฉลี่ยรายขั้นตอนของบริการ (OPD 7)</p>
            </div>
            <div class="flex gap-4 items-center bg-white dark:bg-gray-900 p-2 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <UInput v-model="startDate" type="date" size="sm" variant="none" class="w-36 font-bold" />
                <span class="text-gray-300">|</span>
                <UInput v-model="endDate" type="date" size="sm" variant="none" class="w-36 font-bold" />
                <UButton icon="i-heroicons-arrow-path" color="gray" variant="ghost" @click="refresh" :loading="status === 'pending'" />
            </div>
        </header>

        <div v-if="stats" class="space-y-8">
            <!-- Summary Metrics -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <!-- Total Time Card -->
                <div class="lg:col-span-2 bg-[#24695c] rounded-[2rem] p-10 text-white shadow-xl shadow-[#24695c]/20 relative overflow-hidden group">
                    <div class="relative z-10">
                        <p class="text-white/70 text-sm font-bold uppercase tracking-widest mb-4">เวลารวมทั้งหมดเฉลี่ย</p>
                        <div class="flex items-baseline gap-4">
                            <h2 class="text-7xl font-black italic">{{ formatMmSs(stats.total_all) }}</h2>
                            <span class="text-xl font-bold text-white/50">นาที</span>
                        </div>
                        <div class="mt-8 h-3 bg-white/20 rounded-full overflow-hidden">
                            <div class="h-full bg-[#ba895d] transition-all duration-1000" :style="{ width: getWidth(stats.m_total_all, 120) }"></div>
                        </div>
                    </div>
                    <UIcon name="i-heroicons-bolt" class="absolute -right-10 -bottom-10 w-48 h-48 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                </div>

                <!-- Steps Breakdown -->
                <div v-for="step in [
                    { label: 'รอซักประวัติ', val: stats.รอซักประวัติ, m: stats.m_wait_screen, color: 'bg-teal-500', icon: 'i-heroicons-user-plus' },
                    { label: 'ซักประวัติ', val: stats.ซักประวัติ, m: stats.m_screen, color: 'bg-blue-500', icon: 'i-heroicons-pencil-square' },
                    { label: 'รอพบแพทย์', val: stats.รอตรวจ1, m: stats.m_wait_doc1, color: 'bg-[#ba895d]', icon: 'i-heroicons-user-group' },
                    { label: 'แพทย์ตรวจ', val: stats.แพทย์ตรวจ, m: stats.m_doc_time, color: 'bg-green-500', icon: 'i-heroicons-shield-check' }
                ]" :key="step.label" class="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
                    <div class="flex justify-between items-start mb-6">
                        <div :class="['p-3 rounded-2xl text-white shadow-lg', step.color]">
                            <UIcon :name="step.icon" class="w-6 h-6" />
                        </div>
                        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">{{ step.label }}</span>
                    </div>
                    <div>
                        <h4 class="text-3xl font-black text-[#2c323f] dark:text-white">{{ formatMmSs(step.val) }}</h4>
                        <p class="text-xs text-gray-400 font-bold mt-1 uppercase">นาที</p>
                    </div>
                    <div class="mt-6 h-1.5 bg-gray-50 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div :class="['h-full transition-all duration-1000', step.color]" :style="{ width: getWidth(step.m, 30) }"></div>
                    </div>
                </div>
            </div>

            <!-- Distribution & Traffic -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <!-- Stage Distribution -->
                <div class="lg:col-span-8 bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                    <h3 class="text-xl font-bold mb-8">Operational Flow Distribution</h3>
                    <div class="flex h-16 rounded-[1.5rem] overflow-hidden border-4 border-[#f5f7fb] dark:border-gray-800">
                        <div v-for="(step, i) in [
                            { val: stats.m_wait_screen, color: 'bg-teal-400', label: 'รอซัก' },
                            { val: stats.m_screen, color: 'bg-blue-400', label: 'ซักประวัติ' },
                            { val: stats.m_wait_doc1, color: 'bg-[#ba895d]', label: 'รอตรวจ' },
                            { val: stats.m_doc_time, color: 'bg-green-400', label: 'ตรวจ' },
                            { val: stats.m_wait_rx, color: 'bg-orange-400', label: 'ยา' }
                        ]" :key="i" :style="{ width: (step.val / stats.m_total_all * 100) + '%' }" :class="[step.color, 'h-full border-r border-white/20 last:border-r-0 hover:brightness-110 transition-all flex items-center justify-center group relative']">
                            <span class="text-[10px] font-black text-white opacity-0 group-hover:opacity-100 transition-opacity">{{ Math.round(step.val / stats.m_total_all * 100) }}%</span>
                            <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100">{{ step.label }}</div>
                        </div>
                    </div>
                    <div class="mt-12 grid grid-cols-5 gap-4">
                        <div v-for="legend in [
                            { color: 'bg-teal-400', label: 'รอซักประวัติ' },
                            { color: 'bg-blue-400', label: 'ซักประวัติ' },
                            { color: 'bg-[#ba895d]', label: 'รอพบแพทย์' },
                            { color: 'bg-green-400', label: 'แพทย์ตรวจ' },
                            { color: 'bg-orange-400', label: 'รอรับยา' }
                        ]" :key="legend.label" class="flex items-center gap-2">
                            <div :class="['w-3 h-3 rounded-full', legend.color]"></div>
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{{ legend.label }}</span>
                        </div>
                    </div>
                </div>

                <!-- Bottlenecks -->
                <div class="lg:col-span-4 bg-[#fff8e1] dark:bg-[#ba895d]/10 rounded-[2rem] p-8 border border-[#ba895d]/20">
                    <div class="flex items-center gap-3 mb-6">
                        <UIcon name="i-heroicons-exclamation-triangle" class="text-[#ba895d] w-6 h-6" />
                        <h3 class="text-lg font-black text-[#ba895d] uppercase italic">Critical Points</h3>
                    </div>
                    <div class="space-y-4">
                        <template v-if="stats.m_total_all > 60 || stats.m_wait_screen > 20 || stats.m_wait_doc1 > 15">
                            <div v-if="stats.m_total_all > 60" class="p-4 bg-white/50 dark:bg-gray-900/50 rounded-2xl border-l-4 border-red-500 text-xs font-bold text-gray-600 dark:text-gray-300">
                                ⚠️ เวลารวมเฉลี่ยเกิน 60 นาที
                            </div>
                            <div v-if="stats.m_wait_screen > 20" class="p-4 bg-white/50 dark:bg-gray-900/50 rounded-2xl border-l-4 border-[#ba895d] text-xs font-bold text-gray-600 dark:text-gray-300">
                                ⚠️ จุดซักประวัติมีความหนาแน่นสูง
                            </div>
                            <div v-if="stats.m_wait_doc1 > 15" class="p-4 bg-white/50 dark:bg-gray-900/50 rounded-2xl border-l-4 border-[#ba895d] text-xs font-bold text-gray-600 dark:text-gray-300">
                                ⚠️ ระยะเวลารอพบแพทย์เฉลี่ยนานกว่าปกติ
                            </div>
                        </template>
                        <div v-else class="flex flex-col items-center justify-center py-10 opacity-30">
                            <UIcon name="i-heroicons-check-badge" class="w-12 h-12 text-[#24695c]" />
                            <p class="text-[10px] font-black uppercase mt-2">Flow Status: Optimal</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Traffic Trending -->
            <div class="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 class="text-xl font-bold mb-8">Visit Traffic Trending</h3>
                <div class="h-64 flex items-end gap-2 px-4 pt-10">
                    <div 
                        v-for="t in displayTraffic" 
                        :key="t.hour" 
                        class="flex-1 bg-[#f5f7fb] dark:bg-gray-800 rounded-t-xl relative group transition-all duration-500"
                        :style="{ height: (t.total / maxTraffic * 100) + '%' }"
                    >
                        <div class="absolute inset-0 bg-[#24695c]/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl"></div>
                        <div class="absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-black text-[#24695c] opacity-0 group-hover:opacity-100 whitespace-nowrap">
                            {{ t.total }} คน
                        </div>
                        <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-400">
                            {{ String(t.hour).padStart(2, '0') }}:00
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="status !== 'pending'" class="py-32 flex flex-col items-center justify-center bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
            <UIcon name="i-heroicons-calendar-days" class="w-16 h-16 text-gray-100 dark:text-gray-800 mb-4" />
            <p class="text-gray-400 font-bold uppercase tracking-widest">ไม่พบสถิติในช่วงเวลาที่คุณเลือก</p>
        </div>
    </div>
</template>
