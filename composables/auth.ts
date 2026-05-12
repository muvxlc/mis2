export const useUser = () => {
  const user = useState<any>('user', () => null);

  const fetchUser = async () => {
    // useRequestFetch ensures headers (like cookies) are forwarded during SSR
    const fetcher = useRequestFetch();
    try {
      const data = await fetcher('/api/auth/me');
      user.value = data;
      return data;
    } catch (e) {
      user.value = null;
      return null;
    }
  };

  const logout = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' });
    user.value = null;
    await navigateTo('/login');
  };

  return {
    user,
    fetchUser,
    logout
  };
};
