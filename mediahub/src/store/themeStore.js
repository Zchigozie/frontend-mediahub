import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const getSystemPrefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

// Applies the resolved theme (light/dark) to <html> so Tailwind's
// `dark:` classes and the .dark CSS vars actually kick in.
const applyResolvedTheme = (theme) => {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'system' ? getSystemPrefersDark() : theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
};

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'system', // 'light' | 'dark' | 'system' — system is default
      // Cycles through all three modes: light -> dark -> system -> light
      toggleTheme: () =>
        set((state) => {
          const next =
            state.theme === 'light' ? 'dark' : state.theme === 'dark' ? 'system' : 'light';
          applyResolvedTheme(next);
          return { theme: next };
        }),
      setTheme: (theme) => {
        applyResolvedTheme(theme);
        set({ theme });
      },
      // Call once on app boot (see initThemeListener below) to resolve
      // the actual light/dark value for the current theme setting.
      resolvedTheme: () => {
        const { theme } = get();
        return theme === 'system' ? (getSystemPrefersDark() ? 'dark' : 'light') : theme;
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        // Apply immediately once persisted value (or default) loads,
        // so there's no flash of the wrong theme on refresh.
        if (state) applyResolvedTheme(state.theme);
      },
    }
  )
);

// Call this once at app startup (e.g. in main.jsx or App.jsx) to keep
// the theme in sync if the OS switches light/dark while in 'system' mode.
export const initThemeListener = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  // Cover the case where the store hydrates before this runs.
  applyResolvedTheme(useThemeStore.getState().theme);

  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    const { theme } = useThemeStore.getState();
    if (theme === 'system') applyResolvedTheme('system');
  };

  mql.addEventListener('change', handleChange);
  return () => mql.removeEventListener('change', handleChange);
};