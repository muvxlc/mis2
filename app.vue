<script setup lang="ts">
const colorMode = useColorMode();
const isDark = computed({
    get: () => colorMode.value === "dark",
    set: (value) => (colorMode.preference = value ? "dark" : "light"),
});

const { user, logout } = useUser();
const isSidebarOpen = ref(true);
const route = useRoute();
const isLoginPage = computed(() => route.path === '/login');

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

const navigation = computed(() => [
    {
        group: 'HOSxP',
        items: [
            { 
                label: 'Dashboard', 
                icon: 'i-heroicons-home', 
                to: '/',
                children: [
                    { label: 'Overview', to: '/' },
                    { label: 'Waiting', to: '/hosxp/waiting' }
                ]
            },
            { label: 'Widgets', icon: 'i-heroicons-squares-2x2', to: '#' },
        ]
    },
    {
        group: 'Applications',
        items: [
            { label: 'Project', icon: 'i-heroicons-briefcase', to: '#' },
            { label: 'File Manager', icon: 'i-heroicons-folder', to: '#' },
            { label: 'Kanban', icon: 'i-heroicons-view-columns', to: '#' },
            { label: 'Ecommerce', icon: 'i-heroicons-shopping-cart', to: '#' },
            { label: 'Email', icon: 'i-heroicons-envelope', to: '#' },
            { label: 'Chat', icon: 'i-heroicons-chat-bubble-left-right', to: '#' },
            { label: 'Users', icon: 'i-heroicons-users', to: '/admin/users', show: () => !!user.value },
        ]
    },
    {
        group: 'Settings',
        items: [
            { label: 'HOSxP Database', icon: 'i-heroicons-circle-stack', to: '/admin/external-db', show: () => !!user.value },
            { label: 'General Settings', icon: 'i-heroicons-cog-6-tooth', to: '#' },
        ]
    }
]);

const toggleSidebar = () => {
    isSidebarOpen.value = !isSidebarOpen.value;
};
</script>

<template>
    <UApp>
        <div class="flex min-h-screen bg-[#f5f7fb] dark:bg-gray-950 text-[#2c323f] dark:text-gray-100 font-thai">
            <!-- Sidebar -->
            <aside 
                v-if="!isLoginPage"
                :class="[
                    'fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-300 lg:translate-x-0 lg:static lg:inset-0',
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                ]"
            >
                <div class="flex flex-col h-full">
                    <!-- Logo -->
                    <div class="h-20 flex items-center px-8 border-b border-gray-100 dark:border-gray-800">
                        <NuxtLink to="/" class="flex items-center gap-2">
                            <div class="w-8 h-8 bg-[#24695c] rounded-lg flex items-center justify-center text-white font-bold">M</div>
                            <span class="text-2xl font-bold tracking-tight text-[#24695c] dark:text-white">mis</span>
                        </NuxtLink>
                    </div>

                    <!-- Profile Section -->
                    <div class="p-8 text-center border-b border-gray-100 dark:border-gray-800">
                        <div class="relative inline-block">
                            <UAvatar 
                                :src="user?.avatar || 'https://github.com/benjamincanac.png'" 
                                size="xl" 
                                class="ring-4 ring-[#f5f7fb] dark:ring-gray-800"
                            />
                            <span class="absolute top-0 right-0 bg-[#ba895d] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase">New</span>
                        </div>
                        <h3 class="mt-4 font-bold text-lg">{{ user?.fullName || 'Emay Walter' }}</h3>
                        <p class="text-xs text-gray-400 uppercase tracking-wider mt-1">{{ user?.agency || 'Human Resources Department' }}</p>
                        
                        <div class="flex justify-center gap-8 mt-6">
                            <div>
                                <div class="font-bold text-sm">7</div>
                                <div class="text-[10px] text-gray-400 uppercase">Exp</div>
                            </div>
                            <div>
                                <div class="font-bold text-sm">98</div>
                                <div class="text-[10px] text-gray-400 uppercase">Bth</div>
                            </div>
                            <div>
                                <div class="font-bold text-sm">2</div>
                                <div class="text-[10px] text-gray-400 uppercase">Pic</div>
                            </div>
                        </div>
                    </div>

                    <!-- Navigation -->
                    <nav class="flex-1 overflow-y-auto py-6 px-4 space-y-8">
                        <div v-for="group in navigation" :key="group.group">
                            <h4 class="px-4 text-[11px] font-bold text-gray-400 uppercase tracking-[2px] mb-4">{{ group.group }}</h4>
                            <div class="space-y-1">
                                <template v-for="item in group.items" :key="item.label">
                                    <div v-if="!item.show || item.show()" class="space-y-1">
                                        <NuxtLink 
                                            :to="item.to"
                                            class="flex items-center gap-4 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group"
                                            active-class="bg-[#24695c] text-white shadow-lg shadow-[#24695c]/20"
                                            :class="[route.path === item.to || (item.children && item.children.some(c => route.path === c.to)) ? '' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-[#24695c]']"
                                        >
                                            <UIcon :name="item.icon" class="w-5 h-5" />
                                            <span>{{ item.label }}</span>
                                            <UIcon v-if="item.children" name="i-heroicons-chevron-down" class="ml-auto w-4 h-4 opacity-50" />
                                            <UIcon v-else-if="item.to === '#'" name="i-heroicons-chevron-right" class="ml-auto w-4 h-4 opacity-50" />
                                        </NuxtLink>

                                        <!-- Submenu -->
                                        <div v-if="item.children && (route.path === item.to || item.children.some(c => route.path === c.to))" class="ml-9 space-y-1 border-l-2 border-gray-100 dark:border-gray-800 pl-4 py-1">
                                            <NuxtLink 
                                                v-for="sub in item.children" 
                                                :key="sub.label"
                                                :to="sub.to"
                                                class="block py-2 text-xs font-bold transition-colors"
                                                :class="[route.path === sub.to ? 'text-[#24695c]' : 'text-gray-400 hover:text-[#24695c]']"
                                            >
                                                {{ sub.label }}
                                            </NuxtLink>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </nav>
                </div>
            </aside>

            <!-- Main Content -->
            <div class="flex-1 flex flex-col min-w-0">
                <!-- Navbar -->
                <header 
                    v-if="!isLoginPage"
                    class="h-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-8 sticky top-0 z-40"
                >
                    <div class="flex items-center gap-6 flex-1">
                        <UButton 
                            icon="i-heroicons-bars-3-bottom-left" 
                            variant="ghost" 
                            color="gray" 
                            @click="toggleSidebar"
                            class="lg:hidden"
                        />
                        <div class="relative max-w-md w-full hidden md:block">
                            <UIcon name="i-heroicons-magnifying-glass" class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input 
                                type="text" 
                                placeholder="Search here....." 
                                class="w-full pl-12 pr-4 py-2.5 bg-[#f5f7fb] dark:bg-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#24695c]/20 transition-all"
                            />
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <UButton icon="i-heroicons-arrows-pointing-out" variant="ghost" color="gray" class="hidden sm:flex" />
                        <UButton icon="i-heroicons-language" variant="ghost" color="gray" class="hidden sm:flex" />
                        <UButton icon="i-heroicons-star" variant="ghost" color="gray" class="hidden sm:flex" />
                        <div class="relative">
                            <UButton icon="i-heroicons-bell" variant="ghost" color="gray" />
                            <span class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                        </div>
                        <UButton 
                            :icon="isDark ? 'i-heroicons-moon' : 'i-heroicons-sun'" 
                            variant="ghost" 
                            color="gray" 
                            @click="isDark = !isDark" 
                        />
                        <UButton icon="i-heroicons-chat-bubble-left" variant="ghost" color="gray" />
                        <div class="w-px h-6 bg-gray-100 dark:bg-gray-800 mx-2"></div>
                        <UButton 
                            icon="i-heroicons-arrow-right-on-rectangle" 
                            variant="ghost" 
                            color="gray" 
                            @click="logout"
                            label="Log out"
                            class="font-bold text-[#24695c]"
                        />
                    </div>
                </header>

                <!-- Page Content -->
                <main :class="['flex-1 overflow-auto', isLoginPage ? '' : 'p-8']">
                    <div :class="[isLoginPage ? 'h-screen' : 'max-w-[1600px] mx-auto']">
                        <NuxtPage />
                    </div>
                </main>
            </div>

            <!-- Mobile Overlay -->
            <div 
                v-if="isSidebarOpen && !isLoginPage" 
                class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden"
                @click="isSidebarOpen = false"
            ></div>
        </div>
    </UApp>
</template>

<style>
@import "tailwindcss";
@import "@nuxt/ui";

:root {
    --font-sans: "IBM Plex Sans Thai", sans-serif;
}

.font-thai {
    font-family: "IBM Plex Sans Thai", sans-serif;
}

body {
    font-family: "IBM Plex Sans Thai", sans-serif;
    @apply bg-[#f5f7fb] dark:bg-gray-950;
}

/* Custom scrollbar */
::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
::-webkit-scrollbar-track {
    background: transparent;
}
::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 10px;
}
.dark ::-webkit-scrollbar-thumb {
    background: #374151;
}
::-webkit-scrollbar-thumb:hover {
    background: #24695c;
}
</style>
