<script setup lang="ts">
const colorMode = useColorMode();
const isDark = computed({
    get: () => colorMode.value === "dark",
    set: (value) => (colorMode.preference = value ? "dark" : "light"),
});

const { user, logout } = useUser();

useHead({
    link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
            crossorigin: "",
        },
        {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap",
        },
    ],
});
</script>

<template>
    <UApp>
        <div
            class="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-thai"
        >
            <nav
                class="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur p-4 sticky top-0 z-50"
            >
                <div
                    class="max-w-7xl mx-auto flex justify-between items-center"
                >
                    <div class="flex items-center gap-8">
                        <NuxtLink
                            to="/"
                            class="text-xl font-bold text-primary flex items-center gap-2"
                        >
                            <UIcon
                                name="i-heroicons-clipboard-document-check"
                            />
                            Nuxt Base Stack
                        </NuxtLink>

                        <!-- Admin Navigation -->
                        <div
                            v-if="
                                user &&
                                (user.role === 'admin' ||
                                    user.role === 'superadmin')
                            "
                            class="hidden md:flex items-center gap-4"
                        >
                            <NuxtLink
                                to="/admin/users"
                                class="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1"
                            >
                                <UIcon name="i-heroicons-users" />
                                จัดการผู้ใช้
                            </NuxtLink>

                        </div>
                    </div>

                    <div class="flex gap-4 items-center">
                        <template v-if="user">
                            <span
                                class="text-sm text-gray-500 hidden sm:inline"
                            >
                                {{ user.fullName || user.username }} ({{
                                    user.role
                                }})
                            </span>
                            <UButton
                                variant="ghost"
                                color="gray"
                                icon="i-heroicons-arrow-right-on-rectangle"
                                @click="logout"
                                aria-label="ออกจากระบบ"
                            />
                        </template>
                        <template v-else>
                            <UButton
                                label="เข้าสู่ระบบ"
                                to="/login"
                                variant="ghost"
                            />
                        </template>

                        <ClientOnly>
                            <UButton
                                :icon="
                                    isDark
                                        ? 'i-heroicons-moon'
                                        : 'i-heroicons-sun'
                                "
                                color="gray"
                                variant="ghost"
                                @click="isDark = !isDark"
                                aria-label="เปลี่ยนโหมดสี"
                            />
                            <template #fallback>
                                <div class="w-8 h-8" />
                            </template>
                        </ClientOnly>
                    </div>
                </div>
            </nav>

            <main class="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <NuxtPage />
            </main>
        </div>
    </UApp>
</template>

<style>
@import "tailwindcss";
@import "@nuxt/ui";

.font-thai {
    font-family: "IBM Plex Sans Thai", sans-serif;
}

body {
    font-family: "IBM Plex Sans Thai", sans-serif;
}
</style>
