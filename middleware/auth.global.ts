export default defineNuxtRouteMiddleware(async (to, from) => {
  const { user, fetchUser } = useUser();

  // If on server and state is empty, fetch. 
  // We don't need fetchUser in plugins if middleware handles it.
  if (import.meta.server && !user.value) {
    await fetchUser();
  }
  
  if (!user.value && to.path !== '/login' && to.path !== '/') {
    return navigateTo('/login');
  }
  
  if (user.value && to.path === '/login') {
    return navigateTo('/');
  }
});
