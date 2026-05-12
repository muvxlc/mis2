<script setup lang="ts">
const { user } = useUser();
</script>

<template>
    <div class="space-y-12 font-thai">
        <!-- Authenticated Dashboard -->
        <div v-if="user" class="space-y-8">
            <div class="flex justify-between items-center">
                <h1 class="text-2xl font-bold">
                    Dashboard
                </h1>
                <div class="text-sm text-gray-500">
                    ยินดีต้อนรับ, {{ user.fullName || user.username }}
                </div>
            </div>

            <!-- Dashboard Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <!-- User Info Card -->
                <UCard class="border-l-4 border-l-blue-500 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                            <UIcon name="i-heroicons-user" class="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                ข้อมูลผู้ใช้งาน
                            </div>
                            <div class="text-lg font-bold">
                                {{ user.fullName || user.username }}
                            </div>
                        </div>
                    </div>
                </UCard>

                <!-- Role Card -->
                <UCard class="border-l-4 border-l-green-500 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                            <UIcon name="i-heroicons-shield-check" class="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                สิทธิ์การใช้งาน
                            </div>
                            <div class="text-lg font-bold capitalize">
                                {{ user.role }}
                            </div>
                        </div>
                    </div>
                </UCard>

                <!-- Agency Card -->
                <UCard class="border-l-4 border-l-purple-500 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                            <UIcon name="i-heroicons-building-office" class="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                หน่วยงาน
                            </div>
                            <div class="text-lg font-bold">
                                {{ user.agency || '-' }}
                            </div>
                        </div>
                    </div>
                </UCard>

                <!-- Auth Method Card -->
                <UCard class="border-l-4 border-l-orange-500 shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                            <UIcon name="i-heroicons-identification" class="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <div class="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                การยืนยันตัวตน
                            </div>
                            <div class="text-lg font-bold">
                                {{ user.thaiId ? 'ThaiID' : 'Local Account' }}
                            </div>
                        </div>
                    </div>
                </UCard>
            </div>

            <!-- Quick Actions -->
            <UCard>
                <template #header>
                    <div class="font-bold text-lg">การดำเนินการด่วน</div>
                </template>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <UButton
                        v-if="['superadmin', 'admin'].includes(user.role)"
                        to="/admin/users"
                        icon="i-heroicons-users"
                        color="blue"
                        size="lg"
                        variant="soft"
                        class="justify-start"
                        label="จัดการผู้ใช้งาน"
                    />
                    <UButton
                        to="/login"
                        icon="i-heroicons-arrow-left-on-rectangle"
                        color="red"
                        size="lg"
                        variant="soft"
                        class="justify-start"
                        label="ออกจากระบบ"
                        @click="async () => { await $fetch('/api/auth/logout', { method: 'POST' }); navigateTo('/login', { replace: true }) }"
                    />
                </div>
            </UCard>
        </div>

        <!-- Public Landing Page -->
        <div v-else class="space-y-12">
            <section class="text-center py-12">
                <h2 class="text-4xl font-extrabold sm:text-6xl text-blue-600">
                    Nuxt Base Stack
                </h2>
                <p class="mt-4 text-xl text-gray-500 max-w-2xl mx-auto">
                    โครงสร้างพื้นฐานสำหรับพัฒนา Web Application ด้วย Nuxt 4
                    พร้อม Docker, Database, และ Authentication
                </p>
                <div class="mt-8 flex justify-center gap-4">
                    <UButton
                        size="xl"
                        label="เข้าสู่ระบบเพื่อเริ่มต้น"
                        icon="i-heroicons-arrow-right"
                        to="/login"
                    />
                </div>
            </section>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <UCard class="hover:border-blue-500 transition-colors shadow-sm text-center">
                    <template #header>
                        <div class="flex flex-col items-center gap-2">
                            <UIcon name="i-heroicons-shield-check" class="text-blue-500 w-10 h-10" />
                            <span class="font-bold text-lg text-gray-900 dark:text-white">ความปลอดภัย</span>
                        </div>
                    </template>
                    รองรับการจัดการสิทธิ์ (RBAC) และการเข้าใช้งานผ่าน ThaiID ของกรมการปกครอง
                </UCard>
                <UCard class="hover:border-blue-500 transition-colors shadow-sm text-center">
                    <template #header>
                        <div class="flex flex-col items-center gap-2">
                            <UIcon name="i-heroicons-server-stack" class="text-blue-500 w-10 h-10" />
                            <span class="font-bold text-lg text-gray-900 dark:text-white">Production Ready</span>
                        </div>
                    </template>
                    พร้อมใช้งานกับ Docker Compose พร้อม Health Check, Rate Limiting, และ Reverse Proxy
                </UCard>
                <UCard class="hover:border-blue-500 transition-colors shadow-sm text-center">
                    <template #header>
                        <div class="flex flex-col items-center gap-2">
                            <UIcon name="i-heroicons-bolt" class="text-blue-500 w-10 h-10" />
                            <span class="font-bold text-lg text-gray-900 dark:text-white">Fast Development</span>
                        </div>
                    </template>
                    พัฒนาได้รวดเร็วด้วย Nuxt 4, Drizzle ORM, และ tooling ที่ทันสมัย
                </UCard>
            </div>
        </div>
    </div>
</template>
