import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Text, View, I18nManager } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { notificationsApi } from '@/lib/api/notifications';

// Configure RTL layout properly
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

export const unstable_settings = {
  // Remove initialRouteName to let the navigation logic handle routing
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  const { isAuthenticated, isAdminUser, user, notificationsEnabled } = useAuthStore();
  const [storeHydrated, setStoreHydrated] = React.useState(false);
  const [fontError, setFontError] = React.useState<string | null>(null);
  const segments = useSegments();
  const router = useRouter();

  // Compute desired group upfront (do not place hooks after conditional returns!)
  const rawRole: unknown = (user as any)?.type ?? (user as any)?.user_type;
  const normalizedRole = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
  const desiredGroup = (normalizedRole === 'admin' || isAdminUser()) ? '/(tabs)' : '/(client-tabs)';

  // Enforce correct top-level group using segments (groups are hidden from pathname)
  React.useEffect(() => {
    if (!loaded || !storeHydrated) return;
    if (!isAuthenticated || !user) return;
    const currentTop = segments[0];
    const desiredTop = desiredGroup.replace('/', ''); // e.g., '(tabs)'
    if (currentTop !== desiredTop) {
      router.replace(desiredGroup as any);
    }
  }, [loaded, storeHydrated, isAuthenticated, user, segments, desiredGroup, normalizedRole, router]);

  // If unauthenticated, ensure we are on the public client group by default
  React.useEffect(() => {
    if (!loaded || !storeHydrated) return;
    if (!isAuthenticated) {
      const currentTop = segments[0];
      // Allow staying on login/register or public client group
      const isAllowed = currentTop === '(client-tabs)' || currentTop === 'login' || currentTop === 'register' || typeof currentTop === 'undefined';
      if (!isAllowed) {
        router.replace('/(client-tabs)');
      }
    }
  }, [loaded, storeHydrated, isAuthenticated, segments, router]);

  // Wait for zustand-persist hydration
  React.useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setStoreHydrated(true);
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[root] onFinishHydration', { user: useAuthStore.getState().user, isAuthenticated: useAuthStore.getState().isAuthenticated });
      }
    });
    // If already hydrated (e.g., fast refresh), reflect immediately
    if (useAuthStore.persist.hasHydrated()) {
      setStoreHydrated(true);
    }
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Effect to monitor authentication changes
  useEffect(() => {
    // Authentication state monitoring
  }, [isAuthenticated, user]);

  // Handle font loading errors gracefully - DO NOT THROW IN PRODUCTION
  useEffect(() => {
    if (error) {
      console.error('Font loading error:', error);
      setFontError(error.message || 'Failed to load fonts');
      
      // In development, you might want to see the error more clearly
      if (__DEV__) {
        console.warn('Font loading failed in development mode:', error);
      }
      
      // DO NOT throw the error - this prevents app crashes
      // Instead, we'll handle it gracefully by continuing with system fonts
    }
  }, [error]);

  useEffect(() => {
    // Hide splash screen when fonts are loaded OR when there's a font error
    // This ensures the app doesn't hang on font loading issues
    if (loaded || fontError) {
      SplashScreen.hideAsync().catch((err) => {
        console.warn('Failed to hide splash screen:', err);
      });
    }
  }, [loaded, fontError]);

  // Set default text styling
  useEffect(() => {
    // Font weight styling can be handled via CSS or style props
  }, []);

  // Register and persist push token for the logged-in user, gated by user preference
  React.useEffect(() => {
    const registerToken = async () => {
      try {
        if (!user?.phone || !notificationsEnabled) return;
        const token = await notificationsApi.requestNotificationPermissions();
        if (token) {
          await notificationsApi.registerPushToken(user.phone, token);
        }
      } catch (e) {
        // ignore
      }
    };
    registerToken();
  }, [user?.phone, notificationsEnabled]);

  // Wait for fonts and auth-store hydration before deciding navigation
  // Allow app to continue even if fonts fail to load
  if ((!loaded && !fontError) || !storeHydrated) {
    return null;
  }

  let content: React.ReactNode = null;

  // אם המשתמש לא מחובר, הצג את דף הבית הציבורי + מסכי התחברות/הרשמה
  if (!isAuthenticated) {
    content = (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(client-tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
    );
  } else if (!user) {
    // אם המשתמש מחובר אבל ה-user עדיין לא נטען, המתן מעט (מניעת ניווט שגוי)
    content = null;
  } else {
    // אם המשתמש מחובר, בדוק איזה סוג משתמש הוא
    // Render a stack that includes both groups; effect above ensures correct group is shown
    content = (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(client-tabs)" />
      </Stack>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {content}
    </GestureHandlerRootView>
  );
}
