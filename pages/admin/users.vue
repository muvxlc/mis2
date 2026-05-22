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
    password: '', 
    fullName: user.fullName || '',
    roleId: user.roleId,
    agencyId: user.agencyId || '',
    thaiId: user.thaiId || ''
  };
  isEditing.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const cancelEdit = () => {
  isEditing.value = false;
  editId.value = null;
  form.value = { username: '', password: '', fullName: '', roleId: '', agencyId: '', thaiId: '' };
};

const saveUser = async () => {
  if (!form.value.username || (!editId.value && !form.value.password) || !form.value.roleId) {
    toast.add({ title: 'Warning', description: 'Please fill in all required fields', color: 'warning' });
    return;
  }

  loading.value = true;
  try {
    if (editId.value) {
      await $fetch(`/api/admin/users/${editId.value}`, {
        method: 'PATCH',
        body: form.value
      });
      toast.add({ title: 'Success', description: 'User updated successfully', color: 'success' });
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: form.value
      });
      toast.add({ title: 'Success', description: 'User created successfully', color: 'success' });
    }
    
    cancelEdit();
    await refresh();
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.statusMessage || 'Failed to save user', color: 'error' });
  } finally {
    loading.value = false;
  }
};

const deleteUser = async (id: number) => {
  if (!confirm('Are you sure you want to delete this user?')) return;
  
  try {
    await $fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    toast.add({ title: 'Success', description: 'User deleted successfully', color: 'success' });
    await refresh();
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.statusMessage || 'Failed to delete user', color: 'error' });
  }
};

const columns = [
  { accessorKey: 'username', header: 'Username' },
  { accessorKey: 'fullName', header: 'Full Name' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'agency', header: 'Agency' },
  { accessorKey: 'actions', header: 'Actions' }
];
</script>

<template>
  <div class="space-y-8 font-thai">
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-[#2c323f] dark:text-white">User Management</h1>
        <p class="text-gray-400 mt-1">Manage system users and their access permissions.</p>
      </div>
      <UButton 
        v-if="!isEditing"
        label="Add New User" 
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
          {{ editId ? 'Edit User' : 'Create New User' }}
        </h2>
        <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="cancelEdit" />
      </div>

      <form @submit.prevent="saveUser" class="space-y-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <UFormField label="Username" required>
            <UInput v-model="form.username" placeholder="e.g. emay_w" size="lg" class="rounded-xl" />
          </UFormField>
          
          <UFormField :label="editId ? 'New Password' : 'Password'" :required="!editId">
            <UInput v-model="form.password" type="password" placeholder="••••••••" size="lg" class="rounded-xl" />
          </UFormField>

          <UFormField label="Full Name" required>
            <UInput v-model="form.fullName" placeholder="Emay Walter" size="lg" class="rounded-xl" />
          </UFormField>

          <UFormField label="Thai ID">
            <UInput v-model="form.thaiId" placeholder="13 digits" size="lg" class="rounded-xl" />
          </UFormField>

          <UFormField label="Role" required>
            <USelect 
              v-model="form.roleId"
              :options="(rolesData as any[])?.map(r => ({ label: r.name, value: r.id }))"
              placeholder="Select Role"
              size="lg"
              class="w-full rounded-xl"
            />
          </UFormField>

          <UFormField label="Agency">
            <USelect 
              v-model="form.agencyId"
              :options="(agenciesData as any[])?.map(a => ({ label: a.name, value: a.id }))"
              placeholder="Select Agency"
              size="lg"
              class="w-full rounded-xl"
            />
          </UFormField>
        </div>

        <div class="flex justify-end gap-4 pt-8 border-t border-gray-50 dark:border-gray-800">
          <UButton label="Cancel" color="gray" variant="ghost" size="lg" class="font-bold" @click="cancelEdit" />
          <UButton 
            type="submit" 
            label="Save Changes" 
            size="lg" 
            :loading="loading" 
            class="bg-[#24695c] hover:bg-[#1a4d43] rounded-xl px-10 font-bold shadow-lg shadow-[#24695c]/20" 
          />
        </div>
      </form>
    </div>

    <!-- User Table -->
    <div class="bg-white dark:bg-gray-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <UTable :data="users || []" :columns="columns" class="w-full">
        <template #username-cell="{ row }">
            <span class="font-bold text-[#24695c]">{{ row.original.username }}</span>
        </template>

        <template #role-cell="{ row }">
          <UBadge 
            :color="row.original.role === 'superadmin' ? 'red' : row.original.role === 'admin' ? 'orange' : 'blue'" 
            variant="subtle"
            class="font-bold uppercase tracking-wider text-[10px] px-3 py-1 rounded-full"
          >
            {{ row.original.role }}
          </UBadge>
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
              @click="deleteUser(row.original.id)"
            />
          </div>
        </template>
      </UTable>
    </div>
  </div>
</template>
