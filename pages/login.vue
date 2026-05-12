<script setup lang="ts">
const username = ref('');
const password = ref('');
const loading = ref(false);
const toast = useToast();
const { fetchUser } = useUser();

const login = async () => {
  console.log('Attempting login for:', username.value);
  if (!username.value || !password.value) return;
  
  loading.value = true;
  try {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    });
    
    console.log('Login response:', response);
    
    // Update shared user state
    await fetchUser();
    
    toast.add({
      title: 'สำเร็จ',
      description: 'เข้าสู่ระบบสำเร็จ',
      color: 'success',
    });
    
    // Redirect to dashboard
    await navigateTo('/');
  } catch (e: any) {
    console.error('Login error:', e);
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
  <div class="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-thai">
    <UCard class="w-full max-w-md bg-white/80 dark:bg-gray-900/80 backdrop-blur">
      <template #header>
        <div class="text-center">
          <h2 class="text-2xl font-bold">เข้าสู่ระบบติดตามโครงการ</h2>
          <p class="text-gray-500 mt-1">กรุณากรอกข้อมูลเพื่อเข้าใช้งาน</p>
        </div>
      </template>

      <!-- Explicitly set method="POST" and action to avoid query params in URL -->
      <form method="POST" action="#" @submit.prevent="login" class="space-y-4">
        <UFormField label="ชื่อผู้ใช้" name="username">
          <UInput
            v-model="username"
            placeholder="admin"
            icon="i-heroicons-user"
            class="w-full"
            required
            autocomplete="username"
          />
        </UFormField>

        <UFormField label="รหัสผ่าน" name="password">
          <UInput
            v-model="password"
            type="password"
            placeholder="••••••••"
            icon="i-heroicons-lock-closed"
            class="w-full"
            required
            autocomplete="current-password"
          />
        </UFormField>

        <div class="pt-2">
          <UButton
            type="submit"
            label="เข้าสู่ระบบ"
            block
            :loading="loading"
            size="lg"
          />
        </div>
      </form>

      <template #footer>
        <div class="space-y-4">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <span class="w-full border-t border-gray-300 dark:border-gray-700"></span>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white dark:bg-gray-900 text-gray-500 font-thai">หรือเข้าใช้งานด้วย</span>
            </div>
          </div>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-heroicons-identification"
            label="เข้าด้วย ThaiID (DOPA)"
            block
            to="/api/auth/thaid/login"
            external
          />
        </div>
      </template>
    </UCard>
  </div>
</template>
