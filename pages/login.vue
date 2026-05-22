<script setup lang="ts">
const username = ref('');
const password = ref('');
const loading = ref(false);
const toast = useToast();
const { fetchUser } = useUser();

const login = async () => {
  if (!username.value || !password.value) return;
  
  loading.value = true;
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    });
    
    await fetchUser();
    
    toast.add({
      title: 'สำเร็จ',
      description: 'เข้าสู่ระบบสำเร็จ',
      color: 'success',
    });
    
    await navigateTo('/');
  } catch (e: any) {
    toast.add({
      title: 'เข้าสู่ระบบล้มเหลว',
      description: e.statusMessage || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      color: 'error',
    });
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-[#fbfbfa] dark:bg-gray-950 p-4 font-thai">
    <div class="w-full max-w-sm space-y-8">
      <!-- Logo/Emoji Header -->
      <div class="text-center space-y-2">
        <div class="text-6xl mb-4">🚀</div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          MIS System
        </h1>
        <p class="text-gray-500 dark:text-gray-400">
          Management Information System
        </p>
      </div>

      <!-- Login Card -->
      <div class="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <form @submit.prevent="login" class="space-y-6">
          <UFormField label="ชื่อผู้ใช้" name="username">
            <UInput
              v-model="username"
              placeholder="Username"
              icon="i-heroicons-user"
              size="lg"
              required
              autocomplete="username"
              class="w-full"
            />
          </UFormField>

          <UFormField label="รหัสผ่าน" name="password">
            <UInput
              v-model="password"
              type="password"
              placeholder="Password"
              icon="i-heroicons-lock-closed"
              size="lg"
              required
              autocomplete="current-password"
              class="w-full"
            />
          </UFormField>

          <UButton
            type="submit"
            label="เข้าสู่ระบบ"
            block
            :loading="loading"
            size="lg"
            class="mt-2"
          />
        </form>

        <!-- Divider -->
        <div class="relative my-8">
          <div class="absolute inset-0 flex items-center">
            <span class="w-full border-t border-gray-200 dark:border-gray-800"></span>
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-white dark:bg-gray-900 px-2 text-gray-500">หรือ</span>
          </div>
        </div>

        <!-- ThaiID Login -->
        <UButton
          color="gray"
          variant="outline"
          icon="i-heroicons-identification"
          label="เข้าใช้งานด้วย ThaiID"
          block
          size="lg"
          to="/api/auth/thaid/login"
          external
        />
      </div>

      <!-- Footer Info -->
      <p class="text-center text-sm text-gray-400 dark:text-gray-600">
        &copy; 2026 MIS Project Team
      </p>
    </div>
  </div>
</template>
