<script setup lang="ts">
const { user } = useUser();

// Fetch HOSxP Data
const { data: hosxpStats, refresh: refreshCount } = await useAsyncData('hosxp_stats', () => $fetch('/api/hosxp/patient-stats'));
const { data: visitData, refresh: refreshOverview } = await useAsyncData('hosxp_visits', () => $fetch('/api/hosxp/visit-overview'));
const { data: clinicData, refresh: refreshClinics } = await useAsyncData('hosxp_clinics', () => $fetch('/api/hosxp/clinic-stats'));

// Calculate max for chart scaling
const maxVisits = computed(() => {
    if (!visitData.value?.data?.length) return 100;
    return Math.max(...visitData.value.data.map((d: any) => d.count), 10);
});

const recentOrders = [
    { id: '2435678', product: 'Yellow New Jacket', date: '2023-08-12', price: '$10.00', status: 'Paid', color: 'bg-green-500' },
    { id: '2435679', product: 'Nike Air Max', date: '2023-08-11', price: '$120.00', status: 'Pending', color: 'bg-orange-500' },
    { id: '2435680', product: 'Apple Watch Series 7', date: '2023-08-10', price: '$399.00', status: 'Paid', color: 'bg-green-500' },
    { id: '2435681', product: 'Sony WH-1000XM4', date: '2023-08-09', price: '$250.00', status: 'Shipped', color: 'bg-blue-500' },
];

const activities = [
    { time: '8-10 AM', title: 'Update Your Profile', desc: 'Quisque a consequat ante sit amet...', color: 'bg-[#24695c]' },
    { time: '11:30 AM', title: 'You Liked Someone\'s Post', desc: 'Quisque a consequat ante sit amet...', color: 'bg-[#ba895d]' },
    { time: '1:00 PM', title: 'New Task Assigned', desc: 'Quisque a consequat ante sit amet...', color: 'bg-blue-500' },
];
</script>

<template>
    <div class="space-y-8 font-thai">
        <div v-if="user" class="space-y-8">
            <!-- Row 1 -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <!-- Welcome Banner -->
                <div class="lg:col-span-4 bg-gradient-to-br from-[#24695c] to-[#3a8d7d] rounded-[2rem] p-10 text-white relative overflow-hidden shadow-xl shadow-[#24695c]/20">
                    <div class="relative z-10">
                        <h1 class="text-3xl font-bold">Welcome back, {{ user?.fullName || user?.username || 'User' }}</h1>
                        <p class="mt-4 text-white/80 leading-relaxed">Here whats happening in your account today. Keep up the good work!</p>
                        <UButton 
                            label="Whats New !" 
                            color="white" 
                            variant="solid" 
                            class="mt-8 px-8 py-3 rounded-xl text-[#24695c] font-bold hover:bg-white/90 transition-all"
                        />
                    </div>
                    <!-- Decorative circles -->
                    <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full"></div>
                    <div class="absolute right-10 top-10 w-20 h-20 bg-white/5 rounded-full"></div>
                </div>

                <!-- Visit Overview -->
                <div class="lg:col-span-8 bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h3 class="text-xl font-bold">Visit Overview</h3>
                            <p class="text-xs text-gray-400 mt-1">สถิติผู้รับบริการรายวัน (เดือนปัจจุบัน)</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <UBadge color="emerald" variant="subtle" class="font-bold">
                                {{ visitData?.status === 'success' ? visitData.dbName : 'Slave DB' }}
                            </UBadge>
                            <UButton icon="i-heroicons-arrow-path" variant="ghost" color="gray" @click="refreshOverview" />
                        </div>
                    </div>
                    
                    <!-- Dynamic Chart Rendering -->
                    <div class="h-64 flex items-end gap-1.5 px-4 overflow-x-auto pb-4 pt-10">
                        <template v-if="visitData?.status === 'success'">
                            <div 
                                v-for="item in visitData.data" 
                                :key="item.day" 
                                class="flex-1 min-w-[18px] rounded-t-lg relative group transition-all duration-500"
                                :style="{ height: (item.count / maxVisits * 100) + '%' }"
                                :class="item.day === new Date().getDate() 
                                    ? 'bg-[#ba895d] shadow-lg shadow-[#ba895d]/30' 
                                    : 'bg-[#24695c]/80 hover:bg-[#24695c]'"
                            >
                                <!-- Floating Label on top of bar -->
                                <div 
                                    v-if="item.count > 0"
                                    class="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-[#24695c] dark:text-[#e0f2f1]"
                                >
                                    {{ item.count }}
                                </div>

                                <div class="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
                                
                                <!-- Tooltip on Hover -->
                                <div class="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#2c323f] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10 font-bold shadow-xl border border-white/10">
                                    วันที่ {{ item.day }}: {{ item.count }} คน
                                </div>
                            </div>
                        </template>
                        <template v-else>
                             <div v-for="i in 30" :key="i" class="flex-1 min-w-[18px] bg-gray-100 dark:bg-gray-800 rounded-t-lg h-4 opacity-50"></div>
                        </template>
                    </div>
                    
                    <div class="flex justify-between mt-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider overflow-x-auto gap-2">
                        <span v-for="i in 31" :key="i" v-show="i % 5 === 1 || i === 31">{{ i }}</span>
                    </div>
                </div>
            </div>

            <!-- Row 2: Patient Stats Breakdown -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <!-- OPD Card -->
                <div class="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-6 group hover:shadow-xl hover:shadow-[#24695c]/5 transition-all duration-300">
                    <div class="w-16 h-16 bg-[#e0f2f1] dark:bg-[#1a4d43]/30 rounded-2xl flex items-center justify-center text-[#24695c] text-3xl group-hover:scale-110 transition-transform">
                        <UIcon name="i-heroicons-user-group" />
                    </div>
                    <div>
                        <div class="text-gray-400 text-sm font-bold uppercase tracking-wider">ผู้รับบริการ OPD</div>
                        <div class="text-3xl font-black text-[#2c323f] dark:text-white mt-1">
                            {{ hosxpStats?.status === 'success' ? hosxpStats.opd.toLocaleString() : '...' }}
                        </div>
                        <div class="text-[10px] text-gray-400 font-bold mt-1">Visit วันนี้</div>
                    </div>
                </div>

                <!-- IPD WARD Card -->
                <div class="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-6 group hover:shadow-xl hover:shadow-[#ba895d]/5 transition-all duration-300">
                    <div class="w-16 h-16 bg-[#fff8e1] dark:bg-[#ba895d]/20 rounded-2xl flex items-center justify-center text-[#ba895d] text-3xl group-hover:scale-110 transition-transform">
                        <UIcon name="i-heroicons-building-office-2" />
                    </div>
                    <div>
                        <div class="text-gray-400 text-sm font-bold uppercase tracking-wider">ผู้รับบริการ WARD</div>
                        <div class="text-3xl font-black text-[#2c323f] dark:text-white mt-1">
                            {{ hosxpStats?.status === 'success' ? hosxpStats.ipd_ward.toLocaleString() : '...' }}
                        </div>
                        <div class="text-[10px] text-gray-400 font-bold mt-1">Admit ใหม่วันนี้</div>
                    </div>
                </div>

                <!-- IPD LR Card -->
                <div class="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center gap-6 group hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
                    <div class="w-16 h-16 bg-blue-50 dark:bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-600 text-3xl group-hover:scale-110 transition-transform">
                        <UIcon name="i-heroicons-heart" />
                    </div>
                    <div>
                        <div class="text-gray-400 text-sm font-bold uppercase tracking-wider">ผู้รับบริการ LR</div>
                        <div class="text-3xl font-black text-[#2c323f] dark:text-white mt-1">
                            {{ hosxpStats?.status === 'success' ? hosxpStats.ipd_lr.toLocaleString() : '...' }}
                        </div>
                        <div class="text-[10px] text-gray-400 font-bold mt-1">Admit ใหม่วันนี้</div>
                    </div>
                </div>
            </div>

            <!-- Row 3: Clinic Stats (Full Width) -->
            <div class="grid grid-cols-1 gap-8">
                <div class="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h3 class="text-xl font-bold">ผู้รับบริการแยกตามห้องตรวจ</h3>
                            <p class="text-xs text-gray-400 mt-1">สรุปจำนวนผู้มาใช้บริการแยกตามแผนก/ห้องตรวจในวันนี้</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <UBadge color="emerald" variant="subtle" class="font-bold">
                                Real-timeจาก HOSxP
                            </UBadge>
                            <UButton icon="i-heroicons-arrow-path" variant="ghost" color="gray" @click="refreshClinics" />
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pr-2">
                        <template v-if="clinicData?.status === 'success' && clinicData.clinics.length > 0">
                            <div v-for="clinic in clinicData.clinics" :key="clinic.clinic_name" class="flex flex-col p-6 rounded-[1.5rem] bg-[#f5f7fb] dark:bg-gray-800/50 group hover:bg-[#24695c] hover:shadow-xl hover:shadow-[#24695c]/20 transition-all duration-300">
                                <div class="flex items-center justify-between mb-4">
                                    <div class="w-10 h-10 rounded-xl bg-white dark:bg-gray-700 flex items-center justify-center text-[#24695c] group-hover:text-[#24695c] group-hover:bg-white transition-all">
                                        <UIcon name="i-heroicons-building-library" class="w-5 h-5" />
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <span class="text-2xl font-black text-[#2c323f] dark:text-white group-hover:text-white transition-colors">{{ clinic.total.toLocaleString() }}</span>
                                        <span class="text-[10px] text-gray-400 font-bold uppercase group-hover:text-white/70">คน</span>
                                    </div>
                                </div>
                                <span class="text-sm font-bold text-[#2c323f] dark:text-white group-hover:text-white transition-colors truncate" :title="clinic.clinic_name">
                                    {{ clinic.clinic_name || 'ไม่ระบุห้องตรวจ' }}
                                </span>
                            </div>
                        </template>
                        <template v-else-if="clinicData?.status === 'success'">
                            <div class="col-span-full text-center py-20 text-gray-400 italic bg-[#f5f7fb] dark:bg-gray-800/30 rounded-[2rem]">ไม่มีข้อมูลผู้รับบริการในวันนี้</div>
                        </template>
                        <template v-else>
                            <div v-for="i in 8" :key="i" class="h-32 w-full bg-gray-50 dark:bg-gray-800 rounded-[1.5rem] animate-pulse"></div>
                        </template>
                    </div>
                </div>
            </div>

            <!-- Row 4: Overview Charts -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Growth Overview -->
                <div class="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                    <h3 class="text-xl font-bold mb-8">Growth Overview</h3>
                    <div class="relative w-48 h-48 mx-auto">
                        <div class="absolute inset-0 border-[16px] border-[#f5f7fb] dark:border-gray-800 rounded-full"></div>
                        <div class="absolute inset-0 border-[16px] border-[#24695c] rounded-full" style="clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 50%)"></div>
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                            <div class="text-3xl font-bold">80%</div>
                            <div class="text-[10px] text-gray-400 font-bold uppercase">Growth</div>
                        </div>
                    </div>
                    <div class="mt-8 space-y-4">
                        <div class="flex items-center justify-between text-sm">
                            <span class="flex items-center gap-2"><span class="w-2 h-2 bg-[#24695c] rounded-full"></span> Online</span>
                            <span class="font-bold">60%</span>
                        </div>
                        <div class="flex items-center justify-between text-sm">
                            <span class="flex items-center gap-2"><span class="w-2 h-2 bg-[#ba895d] rounded-full"></span> Offline</span>
                            <span class="font-bold">40%</span>
                        </div>
                    </div>
                </div>

                <!-- Latest Activity -->
                <div class="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                    <h3 class="text-xl font-bold mb-8">Latest Activity</h3>
                    <div class="space-y-8 relative before:absolute before:left-[31px] before:top-2 before:bottom-2 before:w-px before:bg-gray-100 dark:before:bg-gray-800">
                        <div v-for="act in activities" :key="act.title" class="flex gap-6 relative">
                            <div class="w-16 text-[10px] font-bold text-gray-400 uppercase pt-1">{{ act.time }}</div>
                            <div class="w-4 h-4 rounded-full border-4 border-white dark:border-gray-900 z-10 mt-1" :class="act.color"></div>
                            <div class="flex-1">
                                <div class="font-bold text-sm">{{ act.title }}</div>
                                <div class="text-xs text-gray-400 mt-1 leading-relaxed">{{ act.desc }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Row 5: User Activations & Other -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <!-- User Activations -->
                <div class="lg:col-span-12 bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                    <h3 class="text-xl font-bold mb-8">User Activations</h3>
                    <div class="h-48 flex items-end gap-3">
                        <div v-for="i in 7" :key="i" class="flex-1 bg-[#ba895d]/20 rounded-t-lg relative group" :style="{ height: Math.random() * 80 + 20 + '%' }">
                            <div class="absolute inset-0 bg-[#ba895d] opacity-40 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
                        </div>
                    </div>
                    <div class="flex justify-between mt-4 text-[10px] font-bold text-gray-400 uppercase">
                        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                    </div>
                </div>
            </div>

            <!-- Row 6 -->
            <div class="bg-white dark:bg-gray-900 rounded-[2rem] p-8 shadow-sm border border-gray-100 dark:border-gray-800">
                <div class="flex items-center justify-between mb-8">
                    <h3 class="text-xl font-bold">Recent Orders</h3>
                    <UButton label="View All" variant="ghost" color="gray" class="font-bold text-[#24695c]" />
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-50 dark:border-gray-800">
                                <th class="pb-4 px-4">Order ID</th>
                                <th class="pb-4 px-4">Product</th>
                                <th class="pb-4 px-4">Date</th>
                                <th class="pb-4 px-4">Price</th>
                                <th class="pb-4 px-4">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50 dark:divide-gray-800">
                            <tr v-for="order in recentOrders" :key="order.id" class="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <td class="py-4 px-4 text-sm font-bold text-[#24695c]">#{{ order.id }}</td>
                                <td class="py-4 px-4">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg" :class="order.color"></div>
                                        <span class="text-sm font-medium">{{ order.product }}</span>
                                    </div>
                                </td>
                                <td class="py-4 px-4 text-sm text-gray-500">{{ order.date }}</td>
                                <td class="py-4 px-4 text-sm font-bold">{{ order.price }}</td>
                                <td class="py-4 px-4">
                                    <span 
                                        class="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                        :class="[order.status === 'Paid' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600']"
                                    >
                                        {{ order.status }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Public Landing Page -->
        <div v-else class="min-h-[80vh] flex flex-col items-center justify-center text-center space-y-12">
            <div class="relative">
                <div class="w-32 h-32 bg-[#24695c] rounded-[2.5rem] flex items-center justify-center text-white text-6xl font-bold shadow-2xl shadow-[#24695c]/40">M</div>
                <div class="absolute -top-4 -right-4 w-12 h-12 bg-[#ba895d] rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">🚀</div>
            </div>
            <div class="space-y-6 max-w-2xl">
                <h1 class="text-6xl font-black tracking-tight text-[#2c323f] dark:text-white">
                    mis <span class="text-[#24695c]">Admin</span>
                </h1>
                <p class="text-xl text-gray-500 dark:text-gray-400 leading-relaxed">
                    The most powerful and flexible admin dashboard template. 
                    Built with Nuxt 4 and Tailwind CSS for modern web applications.
                </p>
            </div>
            <div class="flex gap-6">
                <UButton
                    size="xl"
                    label="Get Started"
                    icon="i-heroicons-rocket-launch"
                    to="/login"
                    class="px-10 py-4 rounded-2xl bg-[#24695c] hover:bg-[#1a4d43] shadow-xl shadow-[#24695c]/20 font-bold"
                />
                <UButton
                    size="xl"
                    label="Documentation"
                    variant="outline"
                    color="gray"
                    class="px-10 py-4 rounded-2xl font-bold"
                />
            </div>
        </div>
    </div>
</template>
