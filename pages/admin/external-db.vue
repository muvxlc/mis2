<script setup lang="ts">
const toast = useToast();

const { data: connections, refresh } = await useAsyncData('external_db_list', () => $fetch('/api/admin/external-db'));

const isEditing = ref(false);
const loading = ref(false);
const testing = ref(false);
const editId = ref<number | null>(null);

const form = ref({
  name: '',
  type: 'mysql',
  host: '',
  port: 3306,
  username: '',
  password: '',
  database: '',
  isActive: true
});

const typeOptions = [
  { label: 'MariaDB / MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgres' }
];

watch(() => form.value.type, (newType) => {
  const typeValue = typeof newType === 'object' ? (newType as any).value : newType;
  if (typeValue === 'postgres' && form.value.port === 3306) {
    form.value.port = 5432;
  } else if (typeValue === 'mysql' && form.value.port === 5432) {
    form.value.port = 3306;
  }
});

const startEdit = (conn: any) => {
  editId.value = conn.id;
  form.value = {
    name: conn.name,
    type: conn.type,
    host: conn.host,
    port: conn.port,
    username: conn.username,
    password: '', 
    database: conn.database,
    isActive: Boolean(conn.isActive)
  };
  isEditing.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const cancelEdit = () => {
  isEditing.value = false;
  editId.value = null;
  form.value = { name: '', type: 'mysql', host: '', port: 3306, username: '', password: '', database: '', isActive: true };
};

const testConnection = async () => {
  // Trim all inputs before testing
  const testData = { ...form.value };
  testData.host = testData.host.trim();
  testData.username = testData.username.trim();
  testData.database = testData.database.trim();
  
  // Ensure type is a string
  if (typeof testData.type === 'object') {
    testData.type = (testData.type as any).value;
  }
  
  if (editId.value && !testData.password) {
    toast.add({ title: 'คำเตือน', description: 'กรุณากรอกรหัสผ่านเพื่อทดสอบการเชื่อมต่อ (ระบบจะไม่บันทึกรหัสผ่านเก่าไว้ในหน้าเว็บเพื่อความปลอดภัย)', color: 'warning' });
    return;
  }

  if (!testData.host || !testData.username || !testData.password || !testData.database) {
    toast.add({ title: 'คำเตือน', description: 'กรุณากรอกข้อมูลให้ครบถ้วนเพื่อทดสอบ', color: 'warning' });
    return;
  }

  testing.value = true;
  try {
    const res = await $fetch('/api/admin/external-db/test', {
      method: 'POST',
      body: {
        ...testData,
        isActive: testData.isActive ? 1 : 0
      }
    });
    if (res.success) {
      toast.add({ title: 'สำเร็จ', description: 'เชื่อมต่อฐานข้อมูลได้สำเร็จ', color: 'success' });
    }
  } catch (e: any) {
    toast.add({ title: 'ล้มเหลว', description: e.statusMessage || 'ไม่สามารถเชื่อมต่อได้', color: 'error' });
  } finally {
    testing.value = false;
  }
};

const saveConnection = async () => {
  const submitData: any = { ...form.value };
  submitData.host = submitData.host.trim();
  submitData.username = submitData.username.trim();
  submitData.database = submitData.database.trim();
  
  // Ensure type is a string
  if (typeof submitData.type === 'object') {
    submitData.type = submitData.type.value;
  }
  
  // Convert boolean isActive to integer for the DB
  submitData.isActive = submitData.isActive ? 1 : 0;

  if (!submitData.name || !submitData.host || !submitData.username || (!editId.value && !submitData.password) || !submitData.database) {
    toast.add({ title: 'คำเตือน', description: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', color: 'warning' });
    return;
  }

  loading.value = true;
  try {
    if (editId.value) {
      await $fetch(`/api/admin/external-db/${editId.value}`, {
        method: 'PATCH',
        body: submitData
      });
      toast.add({ title: 'สำเร็จ', description: 'อัปเดตการเชื่อมต่อเรียบร้อยแล้ว', color: 'success' });
    } else {
      await $fetch('/api/admin/external-db', {
        method: 'POST',
        body: submitData
      });
      toast.add({ title: 'สำเร็จ', description: 'บันทึกการเชื่อมต่อใหม่เรียบร้อยแล้ว', color: 'success' });
    }
    
    cancelEdit();
    await refresh();
  } catch (e: any) {
    toast.add({ title: 'ผิดพลาด', description: e.statusMessage || 'ไม่สามารถบันทึกข้อมูลได้', color: 'error' });
  } finally {
    loading.value = false;
  }
};

const deleteConnection = async (id: number) => {
  if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบการเชื่อมวันนี้?')) return;
  
  try {
    await $fetch(`/api/admin/external-db/${id}`, { method: 'DELETE' });
    toast.add({ title: 'สำเร็จ', description: 'ลบการเชื่อมต่อเรียบร้อยแล้ว', color: 'success' });
    await refresh();
  } catch (e: any) {
    toast.add({ title: 'ผิดพลาด', description: e.statusMessage || 'ไม่สามารถลบข้อมูลได้', color: 'error' });
  }
};

const columns = [
  { accessorKey: 'name', header: 'ชื่อเรียก' },
  { accessorKey: 'type', header: 'ประเภท' },
  { accessorKey: 'host', header: 'Host' },
  { accessorKey: 'database', header: 'Database' },
  { accessorKey: 'isActive', header: 'สถานะ' },
  { accessorKey: 'actions', header: 'จัดการ' }
];
</script>

<template>
  <div class="space-y-8 font-thai">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-[#2c323f] dark:text-white flex items-center gap-3">
            <UIcon name="i-heroicons-circle-stack" class="text-[#24695c]" />
            การตั้งค่าฐานข้อมูล HOSxP
        </h1>
        <p class="text-gray-400 mt-1">จัดการการเชื่อมต่อฐานข้อมูลภายนอกสำหรับระบบ HOSxP (MariaDB/Postgres)</p>
      </div>
      <UButton 
        v-if="!isEditing"
        label="เพิ่มการเชื่อมต่อใหม่" 
        icon="i-heroicons-plus" 
        size="lg"
        class="bg-[#24695c] hover:bg-[#1a4d43] rounded-xl px-6 font-bold shadow-lg shadow-[#24695c]/20"
        @click="isEditing = true; editId = null;" 
      />
    </header>

    <!-- Edit/Create Form -->
    <div v-if="isEditing" class="bg-white dark:bg-gray-900 rounded-[2rem] p-10 shadow-sm border border-gray-100 dark:border-gray-800 space-y-8">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold text-[#2c323f] dark:text-white">
          {{ editId ? 'แก้ไขการเชื่อมต่อ' : 'เพิ่มการเชื่อมต่อ HOSxP ใหม่' }}
        </h2>
        <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="cancelEdit" />
      </div>

      <form @submit.prevent="saveConnection" class="space-y-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <UFormField label="ชื่อการเชื่อมต่อ (เช่น HOSxP กองอำนวยการ)" required>
            <UInput v-model="form.name" placeholder="ระบุชื่อเรียก" size="lg" class="rounded-xl" />
          </UFormField>

          <UFormField label="ประเภทฐานข้อมูล" required>
            <USelectMenu 
              v-model="form.type"
              :items="typeOptions"
              value-attribute="value"
              label-attribute="label"
              size="lg"
              class="w-full rounded-xl"
            >
              <template #label>
                {{ typeOptions.find(opt => opt.value === form.type)?.label || 'เลือกประเภท' }}
              </template>
            </USelectMenu>
          </UFormField>
          
          <UFormField label="Host (IP หรือ Domain)" required>
            <UInput v-model="form.host" placeholder="192.168.1.10" size="lg" class="rounded-xl" />
          </UFormField>

          <UFormField label="Port" required>
            <UInput v-model="form.port" type="number" size="lg" class="rounded-xl" />
          </UFormField>

          <UFormField label="ชื่อผู้ใช้ (Username)" required>
            <UInput v-model="form.username" placeholder="sa" size="lg" class="rounded-xl" />
          </UFormField>

          <UFormField :label="editId ? 'รหัสผ่าน (กรอกเฉพาะเมื่อต้องการเปลี่ยน)' : 'รหัสผ่าน'" :required="!editId">
            <UInput 
              v-model="form.password" 
              type="password" 
              :placeholder="editId ? '•••••••• (ไม่ได้เปลี่ยนรหัสผ่านเดิม)' : 'ระบุรหัสผ่าน'" 
              size="lg" 
              class="rounded-xl"
              autocomplete="new-password"
            />
          </UFormField>

          <UFormField label="ชื่อฐานข้อมูล (Database Name)" required>
            <UInput v-model="form.database" placeholder="hos" size="lg" class="rounded-xl" />
          </UFormField>

          <UFormField label="สถานะการใช้งาน">
            <UCheckbox v-model="form.isActive" label="เปิดใช้งานการเชื่อมต่อนี้" />
          </UFormField>
        </div>

        <div class="flex justify-between items-center pt-8 border-t border-gray-50 dark:border-gray-800">
          <UButton 
            label="ทดสอบการเชื่อมต่อ" 
            color="orange" 
            variant="soft" 
            size="lg" 
            class="font-bold rounded-xl px-6"
            :loading="testing"
            @click="testConnection"
          />
          <div class="flex gap-4">
            <UButton label="ยกเลิก" color="gray" variant="ghost" size="lg" class="font-bold" @click="cancelEdit" />
            <UButton 
              type="submit" 
              label="บันทึกข้อมูล" 
              size="lg" 
              :loading="loading" 
              class="bg-[#24695c] hover:bg-[#1a4d43] rounded-xl px-10 font-bold shadow-lg shadow-[#24695c]/20" 
            />
          </div>
        </div>
      </form>
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-gray-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <UTable :data="connections || []" :columns="columns" class="w-full">
        <template #name-cell="{ row }">
            <span class="font-bold text-[#24695c]">{{ row.original.name }}</span>
        </template>

        <template #type-cell="{ row }">
          <UBadge 
            :color="row.original.type === 'mysql' ? 'blue' : 'emerald'" 
            variant="subtle"
            class="font-bold uppercase tracking-wider text-[10px] px-3 py-1 rounded-full"
          >
            {{ row.original.type === 'mysql' ? 'MariaDB/MySQL' : 'PostgreSQL' }}
          </UBadge>
        </template>

        <template #isActive-cell="{ row }">
          <span :class="row.original.isActive ? 'text-green-500' : 'text-red-500'" class="flex items-center gap-1 font-bold text-sm">
            <UIcon :name="row.original.isActive ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'" />
            {{ row.original.isActive ? 'Active' : 'Inactive' }}
          </span>
        </template>
        
        <template #actions-cell="{ row }">
          <div class="flex gap-2">
            <UButton 
              icon="i-heroicons-pencil-square" 
              size="sm" 
              color="gray" 
              variant="ghost" 
              class="hover:text-[#24695c]"
              @click="startEdit(row.original)"
            />
            <UButton 
              icon="i-heroicons-trash" 
              size="sm" 
              color="red" 
              variant="ghost" 
              @click="deleteConnection(row.original.id)"
            />
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
