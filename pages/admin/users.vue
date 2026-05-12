<script setup lang="ts">
const toast = useToast();

const { data: users, refresh, error: usersError } = await useAsyncData('admin_users_list', () => $fetch('/api/admin/users'));
const { data: rolesData } = await useAsyncData('roles_list', () => $fetch('/api/admin/roles'));
const { data: agenciesData } = await useAsyncData('agencies_list', () => $fetch('/api/master/agencies'));

const isEditing = ref(false);
const loading = ref(false);
const editId = ref<number | null>(null);

const form = ref({
  username: '',
  password: '',
  fullName: '',
  roleId: '' as any,
  agencyId: '' as any,
  thaiId: ''
});

const startEdit = (user: any) => {
  editId.value = user.id;
  form.value = {
    username: user.username,
    password: '', // Don't show old password
    fullName: user.fullName || '',
    roleId: user.roleId,
    agencyId: user.agencyId || '',
    thaiId: user.thaiId || ''
  };
  isEditing.value = true;
  // Scroll to form
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const cancelEdit = () => {
  isEditing.value = false;
  editId.value = null;
  form.value = { username: '', password: '', fullName: '', roleId: '', agencyId: '', thaiId: '' };
};

const saveUser = async () => {
  if (!form.value.username || (!editId.value && !form.value.password) || !form.value.roleId) {
    toast.add({ title: 'คำเตือน', description: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', color: 'warning' });
    return;
  }

  loading.value = true;
  try {
    if (editId.value) {
      await $fetch(`/api/admin/users/${editId.value}`, {
        method: 'PATCH',
        body: form.value
      });
      toast.add({ title: 'สำเร็จ', description: 'อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว', color: 'success' });
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: form.value
      });
      toast.add({ title: 'สำเร็จ', description: 'บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว', color: 'success' });
    }
    
    cancelEdit();
    await refresh();
  } catch (e: any) {
    toast.add({ title: 'ผิดพลาด', description: e.statusMessage || 'ไม่สามารถบันทึกข้อมูลได้', color: 'error' });
  } finally {
    loading.value = false;
  }
};

const deleteUser = async (id: number) => {
  if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งานนี้?')) return;
  
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    toast.add({ title: 'สำเร็จ', description: 'ลบผู้ใช้งานเรียบร้อยแล้ว', color: 'success' });
    await refresh();
  } catch (e: any) {
    toast.add({ title: 'ผิดพลาด', description: e.statusMessage || 'ไม่สามารถลบผู้ใช้งานได้', color: 'error' });
  }
};

const columns = [
  { accessorKey: 'username', header: 'ชื่อผู้ใช้' },
  { accessorKey: 'fullName', header: 'ชื่อ-นามสกุล' },
  { accessorKey: 'role', header: 'สิทธิ์การใช้งาน' },
  { accessorKey: 'agency', header: 'หน่วยงาน' },
  { accessorKey: 'actions', header: 'จัดการ' }
];
</script>

<template>
  <div class="space-y-8 font-thai text-gray-900 dark:text-gray-100 max-w-6xl mx-auto">
    <div class="flex justify-between items-center border-b pb-4">
      <h1 class="text-3xl font-black text-primary">จัดการผู้ใช้งานและสิทธิ์</h1>
      <div class="flex gap-3">
        <UButton 
          v-if="!isEditing"
          label="เพิ่มผู้ใช้งานใหม่" 
          icon="i-heroicons-user-plus" 
          size="lg"
          @click="isEditing = true; editId = null;" 
        />
        <UButton label="กลับ" to="/" variant="ghost" color="gray" icon="i-heroicons-arrow-left" size="lg" />
      </div>
    </div>

    <!-- Edit/Create Form - Expanded Width & Size -->
    <UCard v-if="isEditing" class="border-2 border-primary-200 shadow-xl bg-white dark:bg-gray-900 transition-all">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="font-black text-xl text-primary flex items-center gap-2">
            <UIcon :name="editId ? 'i-heroicons-pencil-square' : 'i-heroicons-user-plus'" />
            {{ editId ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'ลงทะเบียนผู้ใช้งานใหม่' }}
          </div>
          <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="cancelEdit" />
        </div>
      </template>

      <form @submit.prevent="saveUser" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <UFormField label="ชื่อผู้ใช้ (Username)" required help="ใช้สำหรับเข้าสู่ระบบ">
            <UInput v-model="form.username" placeholder="เช่น somchai_s" size="lg" class="w-full" />
          </UFormField>
          
          <UFormField :label="editId ? 'รหัสผ่านใหม่' : 'รหัสผ่าน'" :required="!editId" :help="editId ? 'ปล่อยว่างไว้หากไม่ต้องการเปลี่ยน' : 'ขั้นต่ำ 6 ตัวอักษร'">
            <UInput v-model="form.password" type="password" placeholder="••••••••" size="lg" class="w-full" />
          </UFormField>

          <UFormField label="ชื่อ-นามสกุลจริง" required>
            <UInput v-model="form.fullName" placeholder="นายสมชาย สายลม" size="lg" class="w-full" />
          </UFormField>

          <UFormField label="เลขบัตรประจำตัวประชาชน" help="สำหรับยืนยันตัวตนผ่าน ThaiID">
            <UInput v-model="form.thaiId" placeholder="13 หลัก" size="lg" class="w-full" />
          </UFormField>

          <UFormField label="สิทธิ์การใช้งานในระบบ" required>
            <select 
              v-model="form.roleId"
              class="w-full h-12 px-4 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-lg font-medium focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            >
              <option value="" disabled>-- เลือกสิทธิ์การใช้งาน --</option>
              <option v-for="r in (rolesData as any[])" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
          </UFormField>

          <UFormField label="สังกัดหน่วยงาน">
            <select 
              v-model="form.agencyId"
              class="w-full h-12 px-4 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-lg font-medium focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            >
              <option value="" disabled>-- เลือกหน่วยงานที่สังกัด --</option>
              <option v-for="a in (agenciesData as any[])" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </UFormField>
        </div>

        <div class="flex justify-end gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
          <UButton label="ยกเลิกการกรอก" color="gray" variant="ghost" size="lg" @click="cancelEdit" />
          <UButton type="submit" label="บันทึกข้อมูลผู้ใช้งาน" size="lg" :loading="loading" icon="i-heroicons-check-badge" class="px-8" />
        </div>
      </form>
    </UCard>

    <!-- User Table -->
    <UCard class="shadow-md overflow-hidden border-none">
      <template #header>
        <div class="flex items-center gap-2 font-bold text-lg">
          <UIcon name="i-heroicons-users" class="text-primary" />
          รายชื่อผู้ใช้งานทั้งหมดในระบบ
        </div>
      </template>
      
      <UTable :data="users || []" :columns="columns" class="w-full">
        <template #role-cell="{ row }">
          <UBadge 
            :color="row.original.role === 'superadmin' ? 'red' : row.original.role === 'admin' ? 'orange' : 'blue'" 
            variant="solid"
            class="font-bold uppercase tracking-wider text-[10px]"
          >
            {{ row.original.role }}
          </UBadge>
        </template>
        
        <template #actions-cell="{ row }">
          <div class="flex gap-1">
            <UButton 
              icon="i-heroicons-pencil-square" 
              size="sm" 
              color="blue" 
              variant="ghost" 
              class="hover:bg-blue-50 dark:hover:bg-blue-900/30"
              @click="startEdit(row.original)"
            />
            <UButton 
              icon="i-heroicons-trash" 
              size="sm" 
              color="red" 
              variant="ghost" 
              class="hover:bg-red-50 dark:hover:bg-red-900/30"
              @click="deleteUser(row.original.id)"
            />
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
