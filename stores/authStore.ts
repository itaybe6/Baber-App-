import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserType } from '@/constants/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasHydrated: boolean;
  notificationsEnabled: boolean;
  login: (user: User) => void;
  logout: () => void;
  isAdminUser: () => boolean;
  updateUserProfile: (updates: Partial<User>) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      hasHydrated: false,
      isAdmin: false,
      notificationsEnabled: true,
      login: (user: User) => {
        const rawRole: unknown = (user as any)?.type ?? (user as any)?.user_type;
        const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : undefined;
        // If blocked, prevent authenticating
        const isBlocked = Boolean((user as any)?.block);
        set({ user: isBlocked ? null : user, isAuthenticated: !isBlocked, isAdmin: !isBlocked && role === 'admin' });
        
        // Force a re-render by getting the state immediately
        setTimeout(() => {
          const currentState = get();
        }, 100);
      },
      logout: () => {
        // Clear in-memory auth state
        set({ user: null, isAuthenticated: false, isAdmin: false, notificationsEnabled: true });
        // Proactively clear persisted auth to avoid race conditions when the app is killed quickly
        AsyncStorage.removeItem('auth-storage').catch(() => {});
      },
      isAdminUser: () => {
        const { user } = get();
        // Support both the current shape (user.type) and legacy persisted shape (user.user_type)
        const rawRole: unknown = (user as any)?.type ?? (user as any)?.user_type;
        const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : undefined;
        return role === 'admin';
      },
      updateUserProfile: (updates: Partial<User>) => {
        const current = get().user;
        if (!current) return;
        const updatedUser = { ...current, ...updates } as User;
        const rawRole: unknown = (updatedUser as any)?.type ?? (updatedUser as any)?.user_type;
        const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : undefined;
        set({ user: updatedUser, isAdmin: role === 'admin' });
      },
      setNotificationsEnabled: (enabled: boolean) => {
        set({ notificationsEnabled: enabled });
      },
    }),
    {
      name: 'auth-storage',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        // Before rehydration starts
        if (state) {
          state.hasHydrated = false as any;
        }
        return (rehydratedState: AuthState | undefined) => {
          // After rehydration completes
          if (rehydratedState) {
            rehydratedState.hasHydrated = true as any;
            // Backfill isAdmin if missing or inconsistent
            const rawRole: unknown = (rehydratedState.user as any)?.type ?? (rehydratedState.user as any)?.user_type;
            const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : undefined;
            rehydratedState.isAdmin = role === 'admin';
            // Ensure isAuthenticated reflects presence of user
            rehydratedState.isAuthenticated = Boolean(rehydratedState.user);
          }
        };
      },
      migrate: (persistedState: any, version) => {
        // Migrate legacy persisted users that used `user.user_type` instead of `user.type`
        if (!persistedState) return persistedState;
        if (version < 2) {
          const nextState = { ...persistedState };
          if (nextState.user && !nextState.user.type && nextState.user.user_type) {
            nextState.user = { ...nextState.user, type: nextState.user.user_type };
          }
          // Compute isAdmin during migration
          const rawRole: unknown = nextState.user?.type ?? nextState.user?.user_type;
          const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : undefined;
          nextState.isAdmin = role === 'admin';
          return nextState;
        }
        return persistedState;
      },
    }
  )
); 