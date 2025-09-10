import React from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isAdminUser, user } = useAuthStore();
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    // Debug mount log to confirm route is being loaded
    // eslint-disable-next-line no-console
    console.log('[router] / (index) mounted');
  }, []);

  React.useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;

    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }

    const rawRole: unknown = (user as any)?.type ?? (user as any)?.user_type;
    const normalizedRole = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
    const destination = (normalizedRole === 'admin' || isAdminUser()) ? '/(tabs)' : '/(client-tabs)';
    router.replace(destination as any);
  }, [hydrated, isAuthenticated, user, isAdminUser, router]);

  return null;
}


